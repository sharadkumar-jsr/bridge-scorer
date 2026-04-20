'use strict';
// routes/sessions.js — Phase 4b: manual movement + PIN system
const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getHowellMovement, getPhantomPairNumber } = require('../movements');

router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────

/** Generate a unique 4-digit PIN not already used in this session */
async function generateUniquePIN(client, sessionId) {
  const { rows } = await client.query(
    `SELECT pin FROM session_pairs WHERE session_id = $1`, [sessionId]
  );
  const used = new Set(rows.map(r => r.pin));
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (used.has(pin));
  used.add(pin);
  return pin;
}

/** Parse boards string: "1-3" → [1,2,3]  or "1,2,3" → [1,2,3] */
function parseBoards(str) {
  const s = String(str ?? '').trim();
  if (!s) return [];
  if (/^\d+-\d+$/.test(s)) {
    const [a, b] = s.split('-').map(Number);
    const arr = [];
    for (let i = a; i <= b; i++) arr.push(i);
    return arr;
  }
  return s.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
}

// ── GET /api/sessions ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.date, s.tables_count, s.num_boards,
              s.num_rounds, s.has_phantom, s.status, s.results_released,
              s.movement_type, s.invite_token,
              u.display_name AS created_by_name,
              s.created_at, s.updated_at
       FROM sessions s JOIN users u ON u.id = s.created_by
       WHERE s.status != 'archived'
       ORDER BY s.date DESC, s.created_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/sessions/archived ────────────────────────────────
router.get('/archived', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.date, s.tables_count, s.num_boards, s.status,
              s.movement_type, u.display_name AS created_by_name
       FROM sessions s JOIN users u ON u.id = s.created_by
       WHERE s.status = 'archived' ORDER BY s.date DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/sessions/:id ─────────────────────────────────────
router.get('/:id', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.display_name AS created_by_name
       FROM sessions s JOIN users u ON u.id = s.created_by
       WHERE s.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });

    const baseUrl   = (process.env.CLIENT_ORIGIN ?? '').replace('*','');
    const inviteUrl = rows[0].invite_token ? `${baseUrl}/play/${rows[0].invite_token}` : null;

    const pairs = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom, pin
       FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
      [req.params.id]
    );
    const stats = await db.query(
      `SELECT COUNT(*) FILTER (WHERE NOT is_bye) AS total_boards,
              COUNT(*) FILTER (WHERE NOT is_bye AND entered_at IS NOT NULL) AS entered_boards
       FROM board_results WHERE session_id = $1`, [req.params.id]
    );

    res.json({ ...rows[0], inviteUrl, pairs: pairs.rows, stats: stats.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/sessions ────────────────────────────────────────
router.post('/',
  [
    body('name').trim().notEmpty(),
    body('date').optional().isDate(),
    body('movementType').isIn(['howell', 'manual']),
    body('tablesCount').isInt({ min: 2, max: 12 }),
    body('hasPhantom').optional().isBoolean(),
    // Manual movement fields
    body('numRounds').optional().isInt({ min: 1, max: 30 }),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    // Block if active session exists
    const { rows: active } = await db.query(
      `SELECT id, name FROM sessions WHERE status = 'active'`
    );
    if (active.length > 0) {
      return res.status(400).json({
        error: `Cannot create a new session while "${active[0].name}" is still active. Please complete and archive it first.`,
        activeSessionId: active[0].id,
      });
    }

    const {
      name, date, movementType, tablesCount,
      hasPhantom = false, numRounds,
    } = req.body;

    const inviteToken = Math.random().toString(36).slice(2, 10).toLowerCase();
    const client      = await db.connect();

    try {
      await client.query('BEGIN');

      if (movementType === 'howell') {
        // ── Auto Howell movement ──────────────────────────────
        const movement = getHowellMovement(tablesCount);
        if (!movement) {
          return res.status(400).json({
            error: `Howell movement for ${tablesCount} tables is not yet available.`
          });
        }

        const rounds    = Math.max(...movement.map(m => m.round));
        const boards    = [...new Set(movement.flatMap(m => m.boards))].sort((a,b)=>a-b);
        const numBoards = boards.length;
        const phantom   = hasPhantom ? getPhantomPairNumber(tablesCount) : null;

        const { rows } = await client.query(
          `INSERT INTO sessions
             (name, date, tables_count, movement_type, num_boards, num_rounds,
              has_phantom, phantom_pair, status, invite_token, created_by)
           VALUES ($1,$2,$3,'howell',$4,$5,$6,$7,'setup',$8,$9) RETURNING *`,
          [name, date ?? today(), tablesCount, numBoards, rounds,
           hasPhantom, phantom, inviteToken, req.user.id]
        );
        const session = rows[0];

        // Scaffold board_results
        for (const slot of movement) {
          const isBye = phantom !== null && slot.ewPair === phantom;
          for (const boardNum of slot.boards) {
            await client.query(
              `INSERT INTO board_results
                 (session_id, board_number, round, table_number, ns_pair, ew_pair, is_bye)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
              [session.id, boardNum, slot.round, slot.table, slot.nsPair, slot.ewPair, isBye]
            );
          }
        }

        // Scaffold session_pairs with PINs
        const pairNums = [...new Set(movement.flatMap(m => [m.nsPair, m.ewPair]))].sort((a,b)=>a-b);
        for (const p of pairNums) {
          const isPhantom = phantom !== null && p === phantom;
          const pin       = isPhantom ? null : await generateUniquePIN(client, session.id);
          await client.query(
            `INSERT INTO session_pairs (session_id, pair_number, is_phantom, pin)
             VALUES ($1,$2,$3,$4) ON CONFLICT (session_id, pair_number) DO UPDATE SET pin = $4`,
            [session.id, p, isPhantom, pin]
          );
        }

        await client.query('COMMIT');
        const baseUrl = (process.env.CLIENT_ORIGIN ?? '').replace('*','');
        return res.status(201).json({
          ...session, movementType: 'howell',
          inviteUrl: `${baseUrl}/play/${inviteToken}`,
        });

      } else {
        // ── Manual movement — create skeleton, movement entered separately ──
        if (!numRounds || numRounds < 1) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'numRounds is required for manual movement' });
        }

        const { rows } = await client.query(
          `INSERT INTO sessions
             (name, date, tables_count, movement_type, num_boards, num_rounds,
              has_phantom, status, invite_token, created_by)
           VALUES ($1,$2,$3,'manual',0,$4,FALSE,'setup',$5,$6) RETURNING *`,
          [name, date ?? today(), tablesCount, numRounds, inviteToken, req.user.id]
        );
        const session = rows[0];
        await client.query('COMMIT');

        const baseUrl = (process.env.CLIENT_ORIGIN ?? '').replace('*','');
        return res.status(201).json({
          ...session, movementType: 'manual',
          inviteUrl: `${baseUrl}/play/${inviteToken}`,
          needsMovement: true,   // tells the client to go to movement entry page
        });
      }

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      client.release();
    }
  }
);

// ── POST /api/sessions/:id/movement ──────────────────────────
// Submit manual movement: scaffolds board_results + session_pairs + PINs
router.post('/:id/movement',
  [ param('id').isUUID(), body('movement').isArray({ min: 1 }) ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { movement } = req.body;  // [{ round, table, nsPair, ewPair, boards }]

    // Validate each slot
    for (const slot of movement) {
      if (!slot.round || !slot.table || !slot.nsPair || !slot.ewPair || !Array.isArray(slot.boards)) {
        return res.status(400).json({
          error: 'Each movement slot needs: round, table, nsPair, ewPair, boards[]'
        });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Verify session exists and is in setup state
      const { rows: sessionRows } = await client.query(
        `SELECT * FROM sessions WHERE id = $1`, [req.params.id]
      );
      if (!sessionRows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Session not found' });
      }
      if (sessionRows[0].status !== 'setup') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Can only set movement while session is in setup' });
      }

      // Clear any existing board_results and pairs (in case director is re-entering)
      await client.query(`DELETE FROM board_results WHERE session_id = $1`, [req.params.id]);
      await client.query(`DELETE FROM session_pairs WHERE session_id = $1`, [req.params.id]);

      // Scaffold board_results from manual movement
      for (const slot of movement) {
        for (const boardNum of slot.boards) {
          await client.query(
            `INSERT INTO board_results
               (session_id, board_number, round, table_number, ns_pair, ew_pair, is_bye)
             VALUES ($1,$2,$3,$4,$5,$6,FALSE) ON CONFLICT DO NOTHING`,
            [req.params.id, boardNum, slot.round, slot.table, slot.nsPair, slot.ewPair]
          );
        }
      }

      // Collect unique pairs and create with PINs
      const pairNums = [...new Set(movement.flatMap(m => [m.nsPair, m.ewPair]))].sort((a,b)=>a-b);
      for (const p of pairNums) {
        const pin = await generateUniquePIN(client, req.params.id);
        await client.query(
          `INSERT INTO session_pairs (session_id, pair_number, is_phantom, pin)
           VALUES ($1,$2,FALSE,$3) ON CONFLICT (session_id, pair_number)
           DO UPDATE SET pin = $3`,
          [req.params.id, p, pin]
        );
      }

      // Update session with correct counts
      const allBoards = [...new Set(movement.flatMap(m => m.boards))];
      const numRounds = Math.max(...movement.map(m => m.round));
      await client.query(
        `UPDATE sessions SET num_boards = $1, num_rounds = $2 WHERE id = $3`,
        [allBoards.length, numRounds, req.params.id]
      );

      await client.query('COMMIT');

      // Return updated session with pairs+PINs
      const { rows: updatedSession } = await db.query(
        `SELECT * FROM sessions WHERE id = $1`, [req.params.id]
      );
      const { rows: pairs } = await db.query(
        `SELECT pair_number, player1_name, player2_name, is_phantom, pin
         FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
        [req.params.id]
      );

      res.json({ ...updatedSession[0], pairs });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      client.release();
    }
  }
);

// ── PATCH /api/sessions/:id/status ───────────────────────────
router.patch('/:id/status',
  [ param('id').isUUID(), body('status').isIn(['setup','active','completed','archived']) ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
    try {
      const { rows } = await db.query(
        `UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *`,
        [req.body.status, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
      const io = req.app.get('io');
      if (io) {
        const { broadcastStatusChange } = require('../socket/director');
        broadcastStatusChange(io, req.params.id, req.body.status);
      }
      res.json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  }
);

// ── POST /api/sessions/:id/release ───────────────────────────
router.post('/:id/release', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { rows: stats } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE NOT is_bye) AS total,
              COUNT(*) FILTER (WHERE NOT is_bye AND entered_at IS NOT NULL) AS entered
       FROM board_results WHERE session_id = $1`, [req.params.id]
    );
    const total   = parseInt(stats[0].total);
    const entered = parseInt(stats[0].entered);
    if (entered < total) {
      return res.status(400).json({
        error: `${total - entered} boards still not entered.`,
        total, entered, missing: total - entered,
      });
    }
    const { rows } = await db.query(
      `UPDATE sessions SET results_released = TRUE, status = 'completed'
       WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    const io = req.app.get('io');
    if (io) io.to(`session:${req.params.id}`).emit('results:released', { sessionId: req.params.id });
    res.json({ ok: true, session: rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/sessions/:id/archive ───────────────────────────
router.post('/:id/archive', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { rows } = await db.query(
      `UPDATE sessions SET status = 'archived' WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE /api/sessions/:id ──────────────────────────────────
router.delete('/:id', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { rowCount } = await db.query(`DELETE FROM sessions WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

function today() { return new Date().toISOString().slice(0, 10); }

module.exports = router;

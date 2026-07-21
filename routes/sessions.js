'use strict';
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getHowellMovement, getPhantomPairNumber } = require('../movements');

// ── GET /api/sessions ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.display_name AS director_name,
              COUNT(sp.id) FILTER (WHERE sp.is_phantom = FALSE) AS real_pairs
       FROM sessions s
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN session_pairs sp ON sp.session_id = s.id
       WHERE s.status != 'archived'
       GROUP BY s.id, u.display_name
       ORDER BY s.created_at DESC`,
      []
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/sessions/archived ────────────────────────────────
router.get('/archived', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.display_name AS director_name
       FROM sessions s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.status = 'archived'
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/sessions/:id ─────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.display_name AS director_name,
              json_agg(sp ORDER BY sp.pair_number) AS pairs
       FROM sessions s
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN session_pairs sp ON sp.session_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, u.display_name`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/sessions ────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const {
    name, date, tablesCount, movementType = 'howell',
    numBoards, boardsPerRound, hasPhantom = false,
  } = req.body ?? {};

  if (!name || !date || !tablesCount) {
    return res.status(400).json({ error: 'name, date, tablesCount required' });
  }

  // Block if another active session exists
  const { rows: active } = await db.query(
    `SELECT id FROM sessions WHERE status = 'active' AND created_by = $1`,
    [req.user.id]
  );
  if (active.length) {
    return res.status(400).json({ error: 'You already have an active session' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Determine movement params
    let movement = [], phantomPair = null, boards = 0, rounds = 0;

    if (movementType === 'howell') {
      movement    = getHowellMovement(tablesCount, boardsPerRound);
      phantomPair = hasPhantom ? getPhantomPairNumber(tablesCount) : null;
      // Board count is always derived from the (already width-adjusted)
      // movement, so it stays consistent with what actually gets scaffolded.
      boards      = Math.max(...movement.flatMap(m => m.boards));
      rounds      = Math.max(...movement.map(m => m.round));
    } else {
      boards = numBoards ?? 0;
      rounds = 0;
    }

    // Total pair count
    const allPairs = new Set(movement.flatMap(m => [m.nsPair, m.ewPair]));
    const totalPairs = allPairs.size;

    const { rows: sessRows } = await client.query(
      `INSERT INTO sessions
         (name, date, tables_count, movement_type, num_boards, num_rounds,
          has_phantom, phantom_pair, status, invite_token, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'setup',
               gen_random_uuid()::text, $9)
       RETURNING *`,
      [name, date, tablesCount, movementType, boards, rounds,
       hasPhantom, phantomPair, req.user.id]
    );
    const session = sessRows[0];

    // Create session_pairs
    for (const pairNum of [...allPairs].sort((a,b)=>a-b)) {
      const isPhantom = phantomPair !== null && pairNum === phantomPair;
      const pin       = isPhantom ? null : String(Math.floor(1000 + Math.random() * 9000));
      await client.query(
        `INSERT INTO session_pairs
           (session_id, pair_number, is_phantom, pin)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [session.id, pairNum, isPhantom, pin]
      );
    }

    // Scaffold board_results
    for (const slot of movement) {
      for (const boardNum of slot.boards) {
        // ── BYE FIX: check BOTH ns and ew against phantom ─────────────
        const isBye = phantomPair !== null &&
          (slot.nsPair === phantomPair || slot.ewPair === phantomPair);

        await client.query(
          `INSERT INTO board_results
             (session_id, round, table_number, board_number,
              ns_pair, ew_pair, is_bye)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING`,
          [session.id, slot.round, slot.table, boardNum,
           slot.nsPair, slot.ewPair, isBye]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(session);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/sessions/:id/status ───────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body ?? {};
  const allowed = ['active','completed','archived'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const { rows } = await db.query(
      `UPDATE sessions SET status=$1 WHERE id=$2 AND created_by=$3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── PATCH /api/sessions/:id/release ──────────────────────────
router.patch('/:id/release', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE sessions SET results_released=TRUE
       WHERE id=$1 AND created_by=$2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/sessions/:id/movement ──────────────────────────
// Manual movement entry
router.post('/:id/movement', requireAuth, async (req, res) => {
  const { rounds } = req.body ?? {};
  if (!Array.isArray(rounds)) return res.status(400).json({ error: 'rounds array required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const slot of rounds) {
      const { round, table, nsPair, ewPair, boards } = slot;
      for (const boardNum of boards) {
        await client.query(
          `INSERT INTO board_results
             (session_id, round, table_number, board_number, ns_pair, ew_pair, is_bye)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE)
           ON CONFLICT DO NOTHING`,
          [req.params.id, round, table, boardNum, nsPair, ewPair]
        );
      }
    }
    const maxRound = Math.max(...rounds.map(r => r.round));
    await client.query(
      `UPDATE sessions SET num_rounds=$1 WHERE id=$2`,
      [maxRound, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/sessions/:id ──────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const { rows } = await client.query(
      `SELECT id FROM sessions WHERE id=$1 AND created_by=$2`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete in order (FK constraints)
    await client.query(`DELETE FROM board_results  WHERE session_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM session_pairs   WHERE session_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM sessions        WHERE id=$1`,          [req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

'use strict';
// routes/sessions.js — /api/sessions
const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getHowellMovement, getPhantomPairNumber } = require('../movements');

// All session routes require authentication
router.use(requireAuth);

// ── GET /api/sessions ────────────────────────────────────────
// List all sessions (most recent first)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.date, s.tables_count, s.movement_type,
              s.num_boards, s.num_rounds, s.has_phantom, s.status,
              u.display_name AS created_by_name,
              s.created_at, s.updated_at
       FROM sessions s
       JOIN users u ON u.id = s.created_by
       ORDER BY s.date DESC, s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/sessions/:id ────────────────────────────────────
router.get('/:id', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

  try {
    const { rows } = await db.query(
      `SELECT s.*, u.display_name AS created_by_name
       FROM sessions s JOIN users u ON u.id = s.created_by
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });

    // Also attach pairs
    const pairs = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom
       FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
      [req.params.id]
    );
    res.json({ ...rows[0], pairs: pairs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/sessions ───────────────────────────────────────
// Create a new session and scaffold movement rows
router.post(
  '/',
  [
    body('name').trim().notEmpty(),
    body('date').optional().isDate(),
    body('tablesCount').isInt({ min: 3, max: 5 }),
    body('hasPhantom').optional().isBoolean(),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { name, date, tablesCount, hasPhantom = false } = req.body;

    // Derive movement metadata from the hardcoded tables
    const movement = getHowellMovement(tablesCount);
    if (!movement) {
      return res.status(400).json({ error: `No movement defined for ${tablesCount} tables yet` });
    }

    const rounds    = Math.max(...movement.map(m => m.round));
    const boards    = [...new Set(movement.flatMap(m => m.boards))].sort((a,b)=>a-b);
    const numBoards = boards.length;
    const phantom   = hasPhantom ? getPhantomPairNumber(tablesCount) : null;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1. Create the session
      const { rows } = await client.query(
        `INSERT INTO sessions
           (name, date, tables_count, movement_type, num_boards, num_rounds,
            has_phantom, phantom_pair, status, created_by)
         VALUES ($1, $2, $3, 'howell', $4, $5, $6, $7, 'setup', $8)
         RETURNING *`,
        [
          name,
          date ?? new Date().toISOString().slice(0, 10),
          tablesCount,
          numBoards,
          rounds,
          hasPhantom,
          phantom,
          req.user.id,
        ]
      );
      const session = rows[0];

      // 2. Scaffold all board_result rows from the movement (entered_at NULL = not yet scored)
      for (const slot of movement) {
        const isBye = phantom !== null && slot.ewPair === phantom;
        for (const boardNum of slot.boards) {
          await client.query(
            `INSERT INTO board_results
               (session_id, board_number, round, table_number, ns_pair, ew_pair, is_bye)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [session.id, boardNum, slot.round, slot.table, slot.nsPair, slot.ewPair, isBye]
          );
        }
      }

      // 3. Scaffold pair rows (pair numbers only, names filled later)
      const pairNums = [...new Set(movement.flatMap(m => [m.nsPair, m.ewPair]))].sort((a,b)=>a-b);
      for (const p of pairNums) {
        const isPhantom = phantom !== null && p === phantom;
        await client.query(
          `INSERT INTO session_pairs (session_id, pair_number, is_phantom)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [session.id, p, isPhantom]
        );
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
  }
);

// ── PATCH /api/sessions/:id/status ──────────────────────────
router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['setup', 'active', 'completed']),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    try {
      const { rows } = await db.query(
        `UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *`,
        [req.body.status, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── DELETE /api/sessions/:id ─────────────────────────────────
router.delete('/:id', param('id').isUUID(), async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  try {
    const { rowCount } = await db.query(`DELETE FROM sessions WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

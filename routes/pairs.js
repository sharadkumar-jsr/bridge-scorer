'use strict';
// routes/pairs.js — /api/sessions/:sessionId/pairs
const router = require('express').Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// ── GET /api/sessions/:sessionId/pairs ───────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom
       FROM session_pairs
       WHERE session_id = $1
       ORDER BY pair_number`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/sessions/:sessionId/pairs/:pairNumber ───────────
// Update names for a pair
router.put(
  '/:pairNumber',
  [
    param('sessionId').isUUID(),
    param('pairNumber').isInt({ min: 1 }),
    body('player1Name').optional().trim(),
    body('player2Name').optional().trim(),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { player1Name, player2Name } = req.body;
    try {
      const { rows } = await db.query(
        `UPDATE session_pairs
         SET player1_name = COALESCE($1, player1_name),
             player2_name = COALESCE($2, player2_name)
         WHERE session_id = $3 AND pair_number = $4
         RETURNING *`,
        [player1Name ?? null, player2Name ?? null, req.params.sessionId, req.params.pairNumber]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Pair not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;

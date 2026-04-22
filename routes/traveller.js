'use strict';
// routes/traveller.js — GET /api/play/:token/traveller
// Returns all board results grouped by board number
// Only accessible after director releases results
const router = require('express').Router({ mergeParams: true });
const db     = require('../db');
const { requirePlayerAuth } = require('../middleware/playerAuth');

router.get('/', requirePlayerAuth, async (req, res) => {
  try {
    // Check results are released
    const { rows: sessRows } = await db.query(
      `SELECT results_released FROM sessions WHERE id = $1`,
      [req.player.sessionId]
    );
    if (!sessRows[0]) return res.status(404).json({ error: 'Session not found' });
    if (!sessRows[0].results_released) {
      return res.status(403).json({ error: 'Results not yet released by director' });
    }

    // Get all pairs with names
    const { rows: pairRows } = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom
       FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
      [req.player.sessionId]
    );

    // Get all board results with pair names
    const { rows: resultRows } = await db.query(
      `SELECT br.board_number, br.round, br.table_number,
              br.ns_pair, br.ew_pair,
              br.declarer, br.level, br.suit, br.doubled,
              br.tricks, br.ns_score, br.is_bye, br.entered_at
       FROM board_results br
       WHERE br.session_id = $1
       ORDER BY br.board_number, br.ns_score DESC NULLS LAST`,
      [req.player.sessionId]
    );

    // Group by board number
    const boardMap = {};
    for (const r of resultRows) {
      const bn = r.board_number;
      if (!boardMap[bn]) boardMap[bn] = [];
      boardMap[bn].push(r);
    }

    const boards = Object.entries(boardMap)
      .map(([bn, results]) => ({ boardNumber: Number(bn), results }))
      .sort((a, b) => a.boardNumber - b.boardNumber);

    res.json({ pairs: pairRows, boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

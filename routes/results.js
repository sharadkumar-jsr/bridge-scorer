'use strict';
// routes/results.js — /api/sessions/:sessionId/results  &  /scores
const router  = require('express').Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const db      = require('../db');
const { requireAuth }           = require('../middleware/auth');
const { calculateRawScore,
        calculateMatchpoints,
        calculateSessionResults } = require('../scoring-engine');

router.use(requireAuth);

// ── GET /api/sessions/:sessionId/results ─────────────────────
// Returns all board result rows (with entry status)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT br.*,
              ns.player1_name AS ns_p1, ns.player2_name AS ns_p2,
              ew.player1_name AS ew_p1, ew.player2_name AS ew_p2
       FROM board_results br
       LEFT JOIN session_pairs ns ON ns.session_id = br.session_id AND ns.pair_number = br.ns_pair
       LEFT JOIN session_pairs ew ON ew.session_id = br.session_id AND ew.pair_number = br.ew_pair
       WHERE br.session_id = $1
       ORDER BY br.board_number, br.round`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/sessions/:sessionId/results/board/:boardNumber ──
router.get(
  '/board/:boardNumber',
  param('boardNumber').isInt({ min: 1 }),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
    try {
      const { rows } = await db.query(
        `SELECT * FROM board_results
         WHERE session_id = $1 AND board_number = $2
         ORDER BY table_number`,
        [req.params.sessionId, req.params.boardNumber]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── PUT /api/sessions/:sessionId/results/:resultId ───────────
// Enter or update a single board result.
// Emits socket event after saving so the dashboard updates in real time.
router.put(
  '/:resultId',
  [
    param('sessionId').isUUID(),
    param('resultId').isUUID(),
    body('declarer').isIn(['N','S','E','W']),
    body('level').isInt({ min: 0, max: 7 }),
    body('suit').isIn(['C','D','H','S','NT']),
    body('doubled').optional().isIn(['none','doubled','redoubled']),
    body('tricks').isInt({ min: 0, max: 13 }),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { declarer, level, suit, doubled = 'none', tricks } = req.body;

    // Fetch the row so we have board_number for vuln calc
    try {
      const { rows: existing } = await db.query(
        `SELECT * FROM board_results WHERE id = $1 AND session_id = $2`,
        [req.params.resultId, req.params.sessionId]
      );
      if (!existing[0]) return res.status(404).json({ error: 'Result not found' });

      const row = existing[0];
      const nsScore = calculateRawScore({
        declarer,
        level,
        suit,
        doubled,
        tricks,
        boardNumber: row.board_number,
      });

      const { rows: updated } = await db.query(
        `UPDATE board_results
         SET declarer   = $1,
             level      = $2,
             suit       = $3,
             doubled    = $4,
             tricks     = $5,
             ns_score   = $6,
             entered_by = $7,
             entered_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [declarer, level, suit, doubled, tricks, nsScore, req.user.id, req.params.resultId]
      );

      const result = updated[0];

      // ── Emit real-time update via Socket.io ──────────────────
      // req.app.get('io') is set in server.js
      const io = req.app.get('io');
      if (io) {
        // Recalculate the live board matchpoints for this board
        const boardMPs = await liveBoardMatchpoints(req.params.sessionId, result.board_number);
        io.to(`session:${req.params.sessionId}`).emit('result:updated', {
          result,
          boardMatchpoints: boardMPs,
        });
      }

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/sessions/:sessionId/scores ──────────────────────
// Full session rankings — only considers entered results
router.get('/scores', async (req, res) => {
  try {
    const scores = await computeSessionScores(req.params.sessionId);
    res.json(scores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build the session object needed by calculateSessionResults,
 * using only rows that have been entered (entered_at IS NOT NULL).
 */
async function computeSessionScores(sessionId) {
  const { rows: session } = await db.query(
    `SELECT * FROM sessions WHERE id = $1`, [sessionId]
  );
  if (!session[0]) throw new Error('Session not found');

  const { rows: pairRows } = await db.query(
    `SELECT pair_number FROM session_pairs
     WHERE session_id = $1 AND is_phantom = FALSE`,
    [sessionId]
  );
  const pairs = pairRows.map(r => r.pair_number);

  // Fetch all entered results
  const { rows: resultRows } = await db.query(
    `SELECT board_number, ns_pair, ew_pair, ns_score, is_bye
     FROM board_results
     WHERE session_id = $1 AND (entered_at IS NOT NULL OR is_bye = TRUE)`,
    [sessionId]
  );

  // Group by board_number
  const boardMap = {};
  for (const r of resultRows) {
    const b = r.board_number;
    if (!boardMap[b]) boardMap[b] = [];
    boardMap[b].push({
      pairNS:  r.ns_pair,
      pairEW:  r.ew_pair,
      nsScore: r.ns_score ?? 0,
      isBye:   r.is_bye,
    });
  }

  const boards = Object.entries(boardMap).map(([bn, results]) => ({
    boardNumber: Number(bn),
    results,
  }));

  // calculateSessionResults handles raw→MP internally,
  // but we already have nsScore so we pass a pre-scored adapter
  // (skip re-scoring by passing nsScore directly through calculateMatchpoints)
  const totals = {};
  for (const p of pairs) totals[p] = { totalMP: 0, maxMP: 0 };

  for (const board of boards) {
    const mp = calculateMatchpoints(board.results);
    for (const [key, data] of Object.entries(mp)) {
      const p = Number(key);
      if (totals[p] !== undefined) {
        totals[p].totalMP += data.mp;
        totals[p].maxMP   += data.maxMp;
      }
    }
  }

  const rows = pairs.map(p => ({
    pairNumber:  p,
    totalMP:     totals[p].totalMP,
    maxMP:       totals[p].maxMP,
    percentage:  totals[p].maxMP > 0
                   ? ((totals[p].totalMP / totals[p].maxMP) * 100).toFixed(2)
                   : '0.00',
  }));

  rows.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].percentage !== rows[i - 1].percentage) rank = i + 1;
    rows[i].rank = rank;
  }

  return rows;
}

/**
 * Quick matchpoints for a single board — used for real-time socket payload.
 */
async function liveBoardMatchpoints(sessionId, boardNumber) {
  const { rows } = await db.query(
    `SELECT ns_pair, ew_pair, ns_score, is_bye
     FROM board_results
     WHERE session_id = $1 AND board_number = $2
       AND (entered_at IS NOT NULL OR is_bye = TRUE)`,
    [sessionId, boardNumber]
  );

  const results = rows.map(r => ({
    pairNS:  r.ns_pair,
    pairEW:  r.ew_pair,
    nsScore: r.ns_score ?? 0,
    isBye:   r.is_bye,
  }));

  return calculateMatchpoints(results);
}

module.exports = router;
module.exports.computeSessionScores = computeSessionScores;

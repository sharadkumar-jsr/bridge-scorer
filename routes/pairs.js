'use strict';
// routes/pairs.js — /api/sessions/:sessionId/pairs
const router = require('express').Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const MAX_NAME_LEN = 60;

/**
 * Names may be changed only until the first score has been entered.
 * That covers a session still in "setup" AND one that has been started
 * but where no board has been played/entered yet — exactly the "someone
 * dropped out at the last minute" window.
 */
async function getNameLockState(sessionId) {
  const { rows } = await db.query(
    `SELECT s.status, s.created_by,
            EXISTS (SELECT 1 FROM board_results br
                    WHERE br.session_id = s.id AND br.entered_at IS NOT NULL) AS scoring_started
     FROM sessions s WHERE s.id = $1`,
    [sessionId]
  );
  const s = rows[0];
  if (!s) return null;

  let editable = true, reason = null;
  if (s.status !== 'setup' && s.status !== 'active') {
    editable = false; reason = 'This session is finished, so names can no longer be changed.';
  } else if (s.scoring_started) {
    editable = false; reason = 'Scoring has started, so names are now locked.';
  }
  return { editable, reason, createdBy: s.created_by };
}

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

// ── GET /api/sessions/:sessionId/pairs/editable ──────────────
// Tells the director UI whether names can still be changed.
router.get('/editable', param('sessionId').isUUID(), async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ error: 'Invalid session id' });
  try {
    const state = await getNameLockState(req.params.sessionId);
    if (!state) return res.status(404).json({ error: 'Session not found' });
    res.json({ editable: state.editable, reason: state.reason });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/sessions/:sessionId/pairs/:pairNumber ───────────
// Update names for a pair. Allowed only until the first score is entered.
// Sending an empty string clears a name; omitting a field leaves it unchanged.
router.put(
  '/:pairNumber',
  [
    param('sessionId').isUUID(),
    param('pairNumber').isInt({ min: 1 }),
    body('player1Name').optional({ nullable: true }).isString().trim().isLength({ max: MAX_NAME_LEN })
      .withMessage(`Name must be at most ${MAX_NAME_LEN} characters`),
    body('player2Name').optional({ nullable: true }).isString().trim().isLength({ max: MAX_NAME_LEN })
      .withMessage(`Name must be at most ${MAX_NAME_LEN} characters`),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg, errors: errs.array() });

    const { player1Name, player2Name } = req.body;
    const set1 = player1Name !== undefined && player1Name !== null;
    const set2 = player2Name !== undefined && player2Name !== null;

    try {
      const state = await getNameLockState(req.params.sessionId);
      if (!state) return res.status(404).json({ error: 'Session not found' });
      if (state.createdBy !== req.user.id) return res.status(403).json({ error: 'Not your session' });
      if (!state.editable) return res.status(409).json({ error: state.reason, locked: true });

      const { rows } = await db.query(
        `UPDATE session_pairs
         SET player1_name = CASE WHEN $1 THEN NULLIF($2, '') ELSE player1_name END,
             player2_name = CASE WHEN $3 THEN NULLIF($4, '') ELSE player2_name END
         WHERE session_id = $5 AND pair_number = $6 AND is_phantom = FALSE
         RETURNING *`,
        [set1, set1 ? player1Name : null, set2, set2 ? player2Name : null,
         req.params.sessionId, req.params.pairNumber]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Pair not found (the phantom pair has no players)' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;

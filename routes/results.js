'use strict';
// routes/results.js — Board results for director
const router = require('express').Router({ mergeParams: true });
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { calculateRawScore, calculateMatchpoints } = require('../scoring-engine');

// ── GET /api/sessions/:sessionId/results ──────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT br.*
       FROM board_results br
       WHERE br.session_id = $1
       ORDER BY br.round, br.table_number, br.board_number`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/sessions/:sessionId/results/scores ───────────────
// Full standings for director results page
router.get('/scores', requireAuth, async (req, res) => {
  try {
    const { computeFullStandings } = require('./play');
    const standings = await computeFullStandings(req.params.sessionId);
    res.json(standings);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /api/sessions/:sessionId/results/:boardId ─────────────
// Director override — can edit ANY board result regardless of lock
router.put('/:boardId', requireAuth, async (req, res) => {
  const { declarer, level, suit, doubled = 'none', tricks } = req.body ?? {};

  if (level == null) {
    return res.status(400).json({ error: 'level is required' });
  }

  try {
    // Verify board belongs to this session
    const { rows } = await db.query(
      `SELECT br.*, s.created_by
       FROM board_results br
       JOIN sessions s ON s.id = br.session_id
       WHERE br.id = $1 AND br.session_id = $2`,
      [req.params.boardId, req.params.sessionId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Board not found' });
    }
    if (rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }
    if (rows[0].is_bye) {
      return res.status(400).json({ error: 'Cannot edit BYE board' });
    }

    let nsScore = null;

    if (level === 0) {
      // Passed out — score is 0
      nsScore = 0;
    } else {
      if (!declarer || !suit || tricks == null) {
        return res.status(400).json({ error: 'declarer, suit, tricks required' });
      }
      nsScore = calculateRawScore({
        declarer, level, suit, doubled, tricks,
        boardNumber: rows[0].board_number,
      });
    }

    const { rows: updated } = await db.query(
      `UPDATE board_results
       SET declarer=$1, level=$2, suit=$3, doubled=$4,
           tricks=$5, ns_score=$6, entered_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        level === 0 ? 'N' : declarer,
        level,
        level === 0 ? 'NT' : suit,
        level === 0 ? 'none' : doubled,
        level === 0 ? 0 : tricks,
        nsScore,
        req.params.boardId,
      ]
    );

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`session:${req.params.sessionId}`).emit('result:updated', {
        result: updated[0],
        overriddenByDirector: true,
      });
    }

    res.json({ ok: true, nsScore, result: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/sessions/:sessionId/results/:boardId/clear ──────
// Director clears a score — pair will need to re-enter
router.patch('/:boardId/clear', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT br.*, s.created_by
       FROM board_results br
       JOIN sessions s ON s.id = br.session_id
       WHERE br.id = $1 AND br.session_id = $2`,
      [req.params.boardId, req.params.sessionId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Board not found' });
    if (rows[0].created_by !== req.user.id) return res.status(403).json({ error: 'Not your session' });
    if (rows[0].is_bye) return res.status(400).json({ error: 'Cannot clear BYE board' });

    await db.query(
      `UPDATE board_results
       SET declarer=NULL, level=NULL, suit=NULL, doubled='none',
           tricks=NULL, ns_score=NULL, entered_at=NULL
       WHERE id=$1`,
      [req.params.boardId]
    );

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`session:${req.params.sessionId}`).emit('result:cleared', {
        boardId: req.params.boardId,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

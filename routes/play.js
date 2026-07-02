'use strict';
// routes/play.js — Phase 4d: BYE rounds included in schedule explicitly
const router = require('express').Router({ mergeParams: true });
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const { requirePlayerAuth } = require('../middleware/playerAuth');
const { calculateRawScore, calculateMatchpoints } = require('../scoring-engine');

// ── GET /api/play/:token ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, date, tables_count, num_rounds, num_boards,
              status, results_released, has_phantom
       FROM sessions WHERE invite_token = $1`, [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    if (rows[0].status === 'archived') return res.status(410).json({ error: 'Session archived' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/play/:token/pairs ────────────────────────────────
router.get('/pairs', async (req, res) => {
  try {
    const { rows: sess } = await db.query(
      `SELECT id FROM sessions WHERE invite_token = $1`, [req.params.token]
    );
    if (!sess[0]) return res.status(404).json({ error: 'Session not found' });
    const { rows } = await db.query(
      `SELECT pair_number, player1_name, player2_name
       FROM session_pairs
       WHERE session_id = $1 AND is_phantom = FALSE
       ORDER BY pair_number`, [sess[0].id]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/play/:token/join ────────────────────────────────
router.post('/join', async (req, res) => {
  const { pairNumber, pin } = req.body ?? {};
  if (!pairNumber) return res.status(400).json({ error: 'pairNumber required' });
  if (!pin)        return res.status(400).json({ error: 'PIN required' });

  try {
    const { rows: sess } = await db.query(
      `SELECT id, name, status FROM sessions WHERE invite_token = $1`, [req.params.token]
    );
    const session = sess[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'archived') return res.status(410).json({ error: 'Session archived' });
    if (session.status === 'setup')    return res.status(400).json({ error: 'Session not started yet — check with your director' });

    const { rows: pairRows } = await db.query(
      `SELECT pair_number, player1_name, player2_name, pin
       FROM session_pairs
       WHERE session_id = $1 AND pair_number = $2 AND is_phantom = FALSE`,
      [session.id, pairNumber]
    );
    if (!pairRows[0]) return res.status(404).json({ error: 'Pair not found' });
    if (String(pairRows[0].pin).trim() !== String(pin).trim()) {
      return res.status(401).json({ error: 'Incorrect PIN. Please check with your director.' });
    }

    const playerToken = jwt.sign(
      { role: 'player', sessionId: session.id, pairNumber: Number(pairNumber), sessionToken: req.params.token },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      playerToken,
      pair: pairRows[0],
      session: { id: session.id, name: session.name },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/play/:token/schedule ─────────────────────────────
// Now returns ALL board rows including BYE rows (is_bye=TRUE)
// so the client can clearly show BYE rounds as greyed out
router.get('/schedule', requirePlayerAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT br.id, br.round, br.table_number, br.board_number,
              br.ns_pair, br.ew_pair, br.is_bye,
              br.declarer, br.level, br.suit, br.doubled, br.tricks, br.ns_score, br.entered_at,
              ns.player1_name AS ns_p1, ns.player2_name AS ns_p2,
              ew.player1_name AS ew_p1, ew.player2_name AS ew_p2
       FROM board_results br
       LEFT JOIN session_pairs ns ON ns.session_id = br.session_id AND ns.pair_number = br.ns_pair
       LEFT JOIN session_pairs ew ON ew.session_id = br.session_id AND ew.pair_number = br.ew_pair
       WHERE br.session_id = $1
         AND (br.ns_pair = $2 OR br.ew_pair = $2)
       ORDER BY br.round, br.board_number`,
      [req.player.sessionId, req.player.pairNumber]
      // NOTE: removed AND br.is_bye = FALSE  — now includes BYE rows
    );

    const enriched = rows.map(r => ({
      ...r,
      side: r.ns_pair === req.player.pairNumber ? 'NS' : 'EW',
      opponent: r.ns_pair === req.player.pairNumber ? r.ew_pair : r.ns_pair,
      opponentNames: r.ns_pair === req.player.pairNumber
        ? [r.ew_p1, r.ew_p2].filter(Boolean).join(' / ') || `Pair ${r.ew_pair}`
        : [r.ns_p1, r.ns_p2].filter(Boolean).join(' / ') || `Pair ${r.ns_pair}`,
      // Show contract to both pairs once entered — but not for BYE boards
      declarer: (!r.is_bye && r.entered_at) ? r.declarer : null,
      level:    (!r.is_bye && r.entered_at) ? r.level    : null,
      suit:     (!r.is_bye && r.entered_at) ? r.suit     : null,
      doubled:  (!r.is_bye && r.entered_at) ? r.doubled  : null,
      tricks:   (!r.is_bye && r.entered_at) ? r.tricks   : null,
      // canEnter: false for BYE boards or already-entered boards
      canEnter: !r.is_bye && !r.entered_at,
    }));

    res.json(enriched);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /api/play/:token/boards/:resultId ─────────────────────
router.put('/boards/:resultId', requirePlayerAuth, async (req, res) => {
  const { declarer, level, suit, doubled = 'none', tricks } = req.body ?? {};
  if (!declarer || level == null || !suit || tricks == null) {
    return res.status(400).json({ error: 'declarer, level, suit, tricks are required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT br.*, s.status, s.results_released
       FROM board_results br JOIN sessions s ON s.id = br.session_id
       WHERE br.id = $1 AND br.session_id = $2
         AND (br.ns_pair = $3 OR br.ew_pair = $3)`,
      [req.params.resultId, req.player.sessionId, req.player.pairNumber]
    );

    if (!rows[0])                    return res.status(404).json({ error: 'Board not found or not yours' });
    if (rows[0].status !== 'active') return res.status(400).json({ error: 'Session is not active' });
    if (rows[0].results_released)    return res.status(400).json({ error: 'Results already released — no more edits allowed' });

    // Block entry for BYE boards
    if (rows[0].is_bye) {
      return res.status(400).json({
        error: 'This is a BYE round — no score entry required. Average score is awarded automatically.',
        isBye: true,
      });
    }

    // Block editing if already entered by anyone
    if (rows[0].entered_at) {
      return res.status(400).json({
        error: 'Score already entered for this board. Only the director can change it.',
        alreadyEntered: true,
      });
    }

    const nsScore = calculateRawScore({
      declarer, level, suit, doubled, tricks,
      boardNumber: rows[0].board_number,
    });

    const { rows: updated } = await db.query(
      `UPDATE board_results
       SET declarer=$1, level=$2, suit=$3, doubled=$4,
           tricks=$5, ns_score=$6, entered_at=NOW()
       WHERE id=$7 RETURNING *`,
      [declarer, level, suit, doubled, tricks, nsScore, req.params.resultId]
    );

    const io = req.app.get('io');
    if (io) {
      const bmp = await liveBoardMatchpoints(req.player.sessionId, updated[0].board_number);
      io.to(`session:${req.player.sessionId}`).emit('result:updated', {
        result: updated[0], boardMatchpoints: bmp, enteredByPair: req.player.pairNumber,
      });
    }
    res.json({ ok: true, nsScore });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/play/:token/standings ────────────────────────────
router.get('/standings', requirePlayerAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT results_released FROM sessions WHERE id = $1`, [req.player.sessionId]
    );
    if (!rows[0]?.results_released) return res.status(403).json({ error: 'Results not yet released by director' });
    const standings = await computeFullStandings(req.player.sessionId);
    res.json(standings);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/play/:token/myresults ────────────────────────────
router.get('/myresults', requirePlayerAuth, async (req, res) => {
  try {
    const { rows: s } = await db.query(
      `SELECT results_released FROM sessions WHERE id = $1`, [req.player.sessionId]
    );
    if (!s[0]?.results_released) return res.status(403).json({ error: 'Results not yet released' });

    const { rows } = await db.query(
      `SELECT br.board_number, br.round, br.table_number, br.ns_pair, br.ew_pair,
              br.declarer, br.level, br.suit, br.doubled, br.tricks, br.ns_score, br.is_bye
       FROM board_results br
       WHERE br.session_id = $1 AND (br.ns_pair = $2 OR br.ew_pair = $2)
       ORDER BY br.board_number`,
      [req.player.sessionId, req.player.pairNumber]
    );

    const boardNums = [...new Set(rows.filter(r => !r.is_bye).map(r => r.board_number))];
    const myMP = {};
    for (const bn of boardNums) {
      const { rows: all } = await db.query(
        `SELECT ns_pair, ew_pair, ns_score, is_bye FROM board_results
         WHERE session_id=$1 AND board_number=$2 AND (entered_at IS NOT NULL OR is_bye=TRUE)`,
        [req.player.sessionId, bn]
      );
      const mp = calculateMatchpoints(
        all.map(r => ({ pairNS: r.ns_pair, pairEW: r.ew_pair, nsScore: r.ns_score ?? 0, isBye: r.is_bye }))
      );
      if (mp[req.player.pairNumber]) myMP[bn] = mp[req.player.pairNumber];
    }

    res.json(rows.map(r => ({
      ...r,
      side:  r.ns_pair === req.player.pairNumber ? 'NS' : 'EW',
      mp:    myMP[r.board_number]?.mp    ?? null,
      maxMp: myMP[r.board_number]?.maxMp ?? null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/play/:token/boards/:boardNumber/traveller ────────
// LIVE per-board traveller during play.
// A pair may view a board's traveller ONLY after they have themselves
// played and entered that board. This is enforced HERE, server-side,
// via the entered_at check — the client is never trusted to self-limit.
// No results_released gate: this is the mid-session, per-board view.
router.get('/boards/:boardNumber/traveller', requirePlayerAuth, async (req, res) => {
  const boardNumber = Number(req.params.boardNumber);
  if (!Number.isInteger(boardNumber)) {
    return res.status(400).json({ error: 'Invalid board number' });
  }

  try {
    const { rows: sess } = await db.query(
      `SELECT status FROM sessions WHERE id = $1`, [req.player.sessionId]
    );
    if (!sess[0]) return res.status(404).json({ error: 'Session not found' });

    // ── Eligibility gate: has THIS pair actually played + entered this board? ──
    const { rows: eligible } = await db.query(
      `SELECT 1 FROM board_results
       WHERE session_id = $1 AND board_number = $2
         AND (ns_pair = $3 OR ew_pair = $3)
         AND is_bye = FALSE AND entered_at IS NOT NULL
       LIMIT 1`,
      [req.player.sessionId, boardNumber, req.player.pairNumber]
    );
    if (!eligible[0]) {
      return res.status(403).json({
        error: 'You can view this board only after you have played and entered it.',
        notYetPlayed: true,
      });
    }

    // ── All entered (non-bye) results for THIS ONE board ──
    const { rows: resultRows } = await db.query(
      `SELECT br.ns_pair, br.ew_pair,
              br.declarer, br.level, br.suit, br.doubled,
              br.tricks, br.ns_score,
              ns.player1_name AS ns_p1, ns.player2_name AS ns_p2,
              ew.player1_name AS ew_p1, ew.player2_name AS ew_p2
       FROM board_results br
       LEFT JOIN session_pairs ns ON ns.session_id = br.session_id AND ns.pair_number = br.ns_pair
       LEFT JOIN session_pairs ew ON ew.session_id = br.session_id AND ew.pair_number = br.ew_pair
       WHERE br.session_id = $1 AND br.board_number = $2
         AND br.is_bye = FALSE AND br.entered_at IS NOT NULL
       ORDER BY br.ns_score DESC NULLS LAST`,
      [req.player.sessionId, boardNumber]
    );

    // Matchpoint the field (byes don't affect played pairs' MP, so omitting them is exact)
    const mpMap = calculateMatchpoints(
      resultRows.map(r => ({
        pairNS: r.ns_pair, pairEW: r.ew_pair,
        nsScore: r.ns_score ?? 0, isBye: false,
      }))
    );

    const me = req.player.pairNumber;
    const results = resultRows.map(r => ({
      nsPair:   r.ns_pair,
      ewPair:   r.ew_pair,
      nsNames:  [r.ns_p1, r.ns_p2].filter(Boolean).join(' / ') || `Pair ${r.ns_pair}`,
      ewNames:  [r.ew_p1, r.ew_p2].filter(Boolean).join(' / ') || `Pair ${r.ew_pair}`,
      declarer: r.declarer,
      level:    r.level,
      suit:     r.suit,
      doubled:  r.doubled,
      tricks:   r.tricks,
      nsScore:  r.ns_score,
      nsMP:     mpMap[r.ns_pair]?.mp    ?? null,
      ewMP:     mpMap[r.ew_pair]?.mp    ?? null,
      maxMP:    mpMap[r.ns_pair]?.maxMp ?? mpMap[r.ew_pair]?.maxMp ?? null,
      isMine:   r.ns_pair === me || r.ew_pair === me,
    }));

    res.json({ boardNumber, playedCount: results.length, results });
  } catch (err) {
    console.error('[play] board traveller error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Helpers ───────────────────────────────────────────────────
async function liveBoardMatchpoints(sessionId, boardNumber) {
  const { rows } = await db.query(
    `SELECT ns_pair, ew_pair, ns_score, is_bye FROM board_results
     WHERE session_id=$1 AND board_number=$2 AND (entered_at IS NOT NULL OR is_bye=TRUE)`,
    [sessionId, boardNumber]
  );
  return calculateMatchpoints(
    rows.map(r => ({ pairNS: r.ns_pair, pairEW: r.ew_pair, nsScore: r.ns_score ?? 0, isBye: r.is_bye }))
  );
}

async function computeFullStandings(sessionId) {
  const { rows: pairRows } = await db.query(
    `SELECT pair_number, player1_name, player2_name FROM session_pairs
     WHERE session_id=$1 AND is_phantom=FALSE`, [sessionId]
  );
  const pairs  = pairRows.map(r => r.pair_number);
  const totals = {};
  pairs.forEach(p => { totals[p] = { totalMP: 0, maxMP: 0 }; });

  const { rows: results } = await db.query(
    `SELECT board_number, ns_pair, ew_pair, ns_score, is_bye FROM board_results
     WHERE session_id=$1 AND (entered_at IS NOT NULL OR is_bye=TRUE)`, [sessionId]
  );

  const boardMap = {};
  for (const r of results) {
    if (!boardMap[r.board_number]) boardMap[r.board_number] = [];
    boardMap[r.board_number].push({
      pairNS: r.ns_pair, pairEW: r.ew_pair,
      nsScore: r.ns_score ?? 0, isBye: r.is_bye,
    });
  }
  for (const results of Object.values(boardMap)) {
    const mp = calculateMatchpoints(results);
    for (const [key, data] of Object.entries(mp)) {
      const p = Number(key);
      if (totals[p]) { totals[p].totalMP += data.mp; totals[p].maxMP += data.maxMp; }
    }
  }

  const lookup = {};
  pairRows.forEach(p => { lookup[p.pair_number] = p; });

  const rows = pairs.map(p => ({
    pairNumber:  p,
    player1Name: lookup[p]?.player1_name ?? '',
    player2Name: lookup[p]?.player2_name ?? '',
    totalMP:     totals[p].totalMP,
    maxMP:       totals[p].maxMP,
    percentage:  totals[p].maxMP > 0
                   ? ((totals[p].totalMP / totals[p].maxMP) * 100).toFixed(2)
                   : '0.00',
  }));

  rows.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].percentage !== rows[i-1].percentage) rank = i + 1;
    rows[i].rank = rank;
  }
  return rows;
}

module.exports = router;
module.exports.computeFullStandings = computeFullStandings;

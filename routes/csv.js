'use strict';
// routes/csv.js — GET /api/sessions/:id/csv?type=standings|boards  (director only)
//
//   standings → one row per pair: rank, pair, players, total MP, max MP, %
//   boards    → one row per played board: board, round, vul, pairs, contract, tricks, NS score
//
// Opens cleanly in Excel / Google Sheets. Free-text cells (player names) are
// neutralised against spreadsheet formula injection.
const router = require('express').Router({ mergeParams: true });
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeFullStandings } = require('./play');
const { getVulnerability } = require('../scoring-engine');
const { toCsv } = require('../csv-util');

function contractStr(r) {
  if (r.level == null) return '';
  if (r.level === 0) return 'Passed out';
  const dbl = r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : '';
  return `${r.level}${r.suit}${dbl} by ${r.declarer}`;
}

router.get('/', requireAuth, async (req, res) => {
  const type = req.query.type === 'boards' ? 'boards' : 'standings';
  try {
    const { rows: sess } = await db.query(
      `SELECT id, name, date FROM sessions WHERE id = $1`, [req.params.id]
    );
    if (!sess[0]) return res.status(404).json({ error: 'Session not found' });

    // pg returns a DATE as a Date at LOCAL midnight — use local getters so the day
    // doesn't shift in time zones ahead of UTC (toISOString would).
    const d = sess[0].date;
    const date = d instanceof Date
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : String(d).slice(0, 10);

    let csv;
    if (type === 'standings') {
      const standings = await computeFullStandings(req.params.id);
      csv = toCsv(
        ['Rank', 'Pair', 'Player 1', 'Player 2', 'Total MP', 'Max MP', 'Percentage'],
        standings.map(s => [s.rank, s.pairNumber, s.player1Name, s.player2Name,
                            s.totalMP, s.maxMP, s.percentage])
      );
    } else {
      const { rows } = await db.query(
        `SELECT br.board_number, br.round, br.table_number, br.ns_pair, br.ew_pair,
                br.declarer, br.level, br.suit, br.doubled, br.tricks, br.ns_score,
                ns.player1_name AS ns_p1, ns.player2_name AS ns_p2,
                ew.player1_name AS ew_p1, ew.player2_name AS ew_p2
         FROM board_results br
         LEFT JOIN session_pairs ns ON ns.session_id = br.session_id AND ns.pair_number = br.ns_pair
         LEFT JOIN session_pairs ew ON ew.session_id = br.session_id AND ew.pair_number = br.ew_pair
         WHERE br.session_id = $1 AND br.is_bye = FALSE AND br.entered_at IS NOT NULL
         ORDER BY br.board_number, br.round`,
        [req.params.id]
      );
      const names = (a, b, n) => [a, b].filter(Boolean).join(' / ') || `Pair ${n}`;
      csv = toCsv(
        ['Board', 'Vulnerability', 'Round', 'Table', 'NS pair', 'NS players', 'EW pair',
         'EW players', 'Contract', 'Tricks', 'NS score'],
        rows.map(r => [
          r.board_number, getVulnerability(r.board_number), r.round, r.table_number,
          r.ns_pair, names(r.ns_p1, r.ns_p2, r.ns_pair),
          r.ew_pair, names(r.ew_p1, r.ew_p2, r.ew_pair),
          contractStr(r), r.tricks, r.ns_score,
        ])
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bridge-${type}-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[csv] export error', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

module.exports = router;

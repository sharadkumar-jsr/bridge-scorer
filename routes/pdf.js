'use strict';
// routes/pdf.js — Generate session results PDF
// Accessible by director (JWT role=director/admin) OR player (JWT role=player) after results released
const router  = require('express').Router({ mergeParams: true });
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { computeFullStandings } = require('./play');
const PdfPrinter = require('pdfmake');

const FONTS = {
  Helvetica: {
    normal:      'Helvetica',
    bold:        'Helvetica-Bold',
    italics:     'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(FONTS);

// ── Auth middleware — accepts BOTH director and player tokens ──
async function flexAuth(req, res, next) {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (payload.role === 'player') {
      // Player can only download PDF if results are released
      const { rows } = await db.query(
        `SELECT results_released FROM sessions WHERE id = $1`,
        [req.params.id]
      );
      if (!rows[0]) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (!rows[0].results_released) {
        return res.status(403).json({ error: 'Results not yet released by director' });
      }
      // Verify this player belongs to this session
      if (payload.sessionId !== req.params.id) {
        return res.status(403).json({ error: 'You can only download results for your own session' });
      }
      req.user   = null;
      req.player = { sessionId: payload.sessionId, pairNumber: payload.pairNumber };

    } else if (payload.role === 'admin' || payload.role === 'director') {
      // Director can always download
      req.user   = { id: payload.sub, role: payload.role };
      req.player = null;

    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired — please log in again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── GET /api/sessions/:id/pdf ─────────────────────────────────
router.get('/', flexAuth, async (req, res) => {
  try {
    const { rows: sessionRows } = await db.query(
      `SELECT s.*, u.display_name AS director_name
       FROM sessions s LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = $1`,
      [req.params.id]
    );
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const standings = await computeFullStandings(req.params.id);

    const { rows: boardRows } = await db.query(
      `SELECT br.board_number, br.round, br.ns_pair, br.ew_pair,
              br.declarer, br.level, br.suit, br.doubled,
              br.tricks, br.ns_score, br.is_bye,
              ns.player1_name AS ns_p1, ns.player2_name AS ns_p2,
              ew.player1_name AS ew_p1, ew.player2_name AS ew_p2
       FROM board_results br
       LEFT JOIN session_pairs ns ON ns.session_id = br.session_id AND ns.pair_number = br.ns_pair
       LEFT JOIN session_pairs ew ON ew.session_id = br.session_id AND ew.pair_number = br.ew_pair
       WHERE br.session_id = $1 AND br.is_bye = FALSE
         AND br.entered_at IS NOT NULL
       ORDER BY br.board_number, br.round`,
      [req.params.id]
    );

    const docDef = buildPDF(session, standings, boardRows);
    const pdfDoc = printer.createPdfKitDocument(docDef);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="bridge-results-${session.date}.pdf"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── PDF builder ───────────────────────────────────────────────
function pairName(p1, p2, num) {
  const names = [p1, p2].filter(Boolean);
  return names.length ? names.join(' / ') : `Pair ${num}`;
}

function contractStr(r) {
  if (r.level === 0) return 'Passed Out';
  if (!r.level && r.level !== 0) return '—';
  const dbl = r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : '';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function buildPDF(session, standings, boardRows) {
  const DARK  = '#0b2a1a';
  const GOLD  = '#c9a03c';
  const LIGHT = '#f5ecda';

  return {
    pageSize:    'A4',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: 'Helvetica', fontSize: 10 },

    content: [
      // Header
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 70, color: DARK }], margin: [0,0,0,0] },
      { text: '♠ ♥ ♦ ♣  Bridge Club Scorer', fontSize: 18, bold: true, color: GOLD, margin: [10,-58,0,0] },
      { text: session.name, fontSize: 13, color: LIGHT, margin: [10,4,0,0] },
      { text: `${session.date}  ·  ${session.tables_count} tables  ·  ${session.num_boards} boards  ·  ${session.num_rounds} rounds`,
        fontSize: 9, color: '#a0c0a0', margin: [10,2,0,20] },

      // Standings
      { text: 'Final Standings', fontSize: 14, bold: true, margin: [0,0,0,8] },
      {
        table: {
          headerRows: 1,
          widths: [30, 30, '*', 50, 50, 50],
          body: [
            [
              { text: 'Rank', bold: true, fillColor: DARK, color: GOLD },
              { text: 'Pair', bold: true, fillColor: DARK, color: GOLD },
              { text: 'Players',  bold: true, fillColor: DARK, color: GOLD },
              { text: 'MP',      bold: true, fillColor: DARK, color: GOLD, alignment: 'right' },
              { text: 'Max MP',  bold: true, fillColor: DARK, color: GOLD, alignment: 'right' },
              { text: '%',       bold: true, fillColor: DARK, color: GOLD, alignment: 'right' },
            ],
            ...standings.map((s, i) => [
              { text: s.rank,       fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
              { text: s.pairNumber, fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
              { text: pairName(s.player1Name, s.player2Name, s.pairNumber),
                fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
              { text: s.totalMP,   alignment: 'right', fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
              { text: s.maxMP,     alignment: 'right', fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
              { text: `${s.percentage}%`, alignment: 'right', bold: true,
                color: parseFloat(s.percentage) >= 55 ? '#1a7a3a'
                     : parseFloat(s.percentage) < 45  ? '#cc3333' : '#000',
                fillColor: i % 2 === 0 ? '#f0f0e8' : '#ffffff' },
            ]),
          ],
        },
        margin: [0,0,0,20],
      },

      // Board by board
      { text: 'Board by Board Results', fontSize: 14, bold: true, margin: [0,0,0,8], pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: [25, 30, 45, 45, 55, 40, 30, 40],
          body: [
            [
              { text: 'Bd',       bold: true, fillColor: DARK, color: GOLD },
              { text: 'Rnd',      bold: true, fillColor: DARK, color: GOLD },
              { text: 'NS Pair',  bold: true, fillColor: DARK, color: GOLD },
              { text: 'EW Pair',  bold: true, fillColor: DARK, color: GOLD },
              { text: 'Contract', bold: true, fillColor: DARK, color: GOLD },
              { text: 'Tricks',   bold: true, fillColor: DARK, color: GOLD, alignment: 'center' },
              { text: 'Score',    bold: true, fillColor: DARK, color: GOLD, alignment: 'right' },
              { text: 'NS Score', bold: true, fillColor: DARK, color: GOLD, alignment: 'right' },
            ],
            ...boardRows.map((r, i) => {
              const fill = i % 2 === 0 ? '#f0f0e8' : '#ffffff';
              const scoreColor = r.ns_score > 0 ? '#1a7a3a' : r.ns_score < 0 ? '#cc3333' : '#555';
              return [
                { text: r.board_number, fillColor: fill },
                { text: r.round,        fillColor: fill },
                { text: pairName(r.ns_p1, r.ns_p2, r.ns_pair), fillColor: fill, fontSize: 8 },
                { text: pairName(r.ew_p1, r.ew_p2, r.ew_pair), fillColor: fill, fontSize: 8 },
                { text: contractStr(r), fillColor: fill },
                { text: r.tricks ?? '—', alignment: 'center', fillColor: fill },
                { text: r.ns_score != null ? (r.ns_score > 0 ? `+${r.ns_score}` : r.ns_score) : '—',
                  alignment: 'right', color: scoreColor, bold: true, fillColor: fill },
                { text: r.ns_score != null ? (r.ns_score > 0 ? `+${r.ns_score}` : r.ns_score) : '—',
                  alignment: 'right', color: scoreColor, fillColor: fill },
              ];
            }),
          ],
        },
      },

      // Footer
      { text: `Generated by Bridge Club Scorer  ·  ${new Date().toLocaleDateString()}`,
        fontSize: 8, color: '#888', alignment: 'center', margin: [0,20,0,0] },
    ],
  };
}

module.exports = router;

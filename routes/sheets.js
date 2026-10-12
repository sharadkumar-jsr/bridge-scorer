'use strict';
// routes/sheets.js — printable PDF sheets for the director
//
//   GET /api/sessions/:id/sheets/tables  → Round 1 table assignments (to circulate to players)
//   GET /api/sessions/:id/sheets/pins    → pair PIN codes (director only, confidential)
//
// Both use the normal Authorization header (no token in the URL), so the PIN
// sheet is never exposed through links or server logs.
const router     = require('express').Router({ mergeParams: true });
const PdfPrinter = require('pdfmake');
const db         = require('../db');
const { requireAuth } = require('../middleware/auth');
const { buildTablesDoc, buildPinsDoc, fmtDate } = require('../sheet-docs');

const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica', bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique',
  },
  Courier: {
    normal: 'Courier', bold: 'Courier-Bold',
    italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique',
  },
});

function renderPdf(docDef) {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDef);
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadSession(req, res) {
  if (!UUID_RE.test(req.params.id)) { res.status(400).json({ error: 'Invalid session id' }); return null; }
  const { rows } = await db.query(
    `SELECT id, name, date, tables_count, created_by FROM sessions WHERE id = $1`, [req.params.id]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Session not found' }); return null; }
  return rows[0];
}

const dateStr = fmtDate;

function sendPdf(res, buf, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
}

// ── Round 1 table assignments ────────────────────────────────
router.get('/tables', requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;

    const { rows: tables } = await db.query(
      `SELECT table_number, ns_pair, ew_pair, BOOL_OR(is_bye) AS is_bye,
              ARRAY_AGG(board_number ORDER BY board_number) AS boards
       FROM board_results
       WHERE session_id = $1 AND round = 1
       GROUP BY table_number, ns_pair, ew_pair
       ORDER BY table_number`,
      [session.id]
    );
    if (!tables.length) {
      return res.status(400).json({ error: 'No Round 1 movement found for this session yet.' });
    }

    const { rows: pairs } = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom
       FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
      [session.id]
    );

    const buf = await renderPdf(buildTablesDoc(session, pairs, tables));
    sendPdf(res, buf, `round1-tables-${dateStr(session.date)}.pdf`);
  } catch (err) {
    console.error('[sheets] tables error', err);
    res.status(500).json({ error: 'Failed to build the table sheet' });
  }
});

// ── PIN sheet (director only) ────────────────────────────────
router.get('/pins', requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    if (session.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the session director can download the PIN sheet' });
    }

    const { rows: pairs } = await db.query(
      `SELECT pair_number, player1_name, player2_name, is_phantom, pin
       FROM session_pairs WHERE session_id = $1 ORDER BY pair_number`,
      [session.id]
    );

    const buf = await renderPdf(buildPinsDoc(session, pairs));
    sendPdf(res, buf, `pair-pins-${dateStr(session.date)}.pdf`);
  } catch (err) {
    console.error('[sheets] pins error', err);
    res.status(500).json({ error: 'Failed to build the PIN sheet' });
  }
});

module.exports = router;

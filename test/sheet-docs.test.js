'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const PdfPrinter = require('pdfmake');
const { buildTablesDoc, buildPinsDoc, formatBoards } = require('../sheet-docs');

const printer = new PdfPrinter({
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
  Courier:   { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
});
const render = (def) => new Promise((resolve, reject) => {
  const doc = printer.createPdfKitDocument(def);
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  doc.end();
});

const session = { name: 'Tuesday Duplicate', date: '2026-10-13', tables_count: 2 };
const pairs = [
  { pair_number: 1, player1_name: 'Anil', player2_name: 'Rahul', is_phantom: false, pin: '12' },
  { pair_number: 2, player1_name: 'Priya', player2_name: null,   is_phantom: false, pin: '34' },
  { pair_number: 3, player1_name: null,    player2_name: null,   is_phantom: false, pin: '56' },
  { pair_number: 4, player1_name: null,    player2_name: null,   is_phantom: true,  pin: null },
];
const tables = [
  { table_number: 1, ns_pair: 1, ew_pair: 2, is_bye: false, boards: [1, 2, 3] },
  { table_number: 2, ns_pair: 3, ew_pair: 4, is_bye: true,  boards: [4, 5, 6] },
];

test('formatBoards collapses runs', () => {
  assert.equal(formatBoards([1, 2, 3, 5, 6, 9]), '1–3, 5–6, 9');
  assert.equal(formatBoards([4]), '4');
  assert.equal(formatBoards([]), '—');
  assert.equal(formatBoards([3, 1, 2, 2]), '1–3');
});

test('tables sheet renders to a real PDF and lists every real pair', async () => {
  const def = buildTablesDoc(session, pairs, tables);
  const text = JSON.stringify(def);
  for (const n of ['Anil', 'Rahul', 'Priya', 'Pair 3', 'BYE']) assert.ok(text.includes(n), n);
  const buf = await render(def);
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
});

test('A–Z list contains only named players, sorted alphabetically', () => {
  const def = buildTablesDoc(session, pairs, tables);
  const azTable = def.content.filter(c => c.table).pop();            // last table = A–Z list
  const names = azTable.table.body.slice(1).map(row => row[0].text);
  assert.deepEqual(names, ['Anil', 'Priya', 'Rahul']);
});

test('PIN sheet lists real pairs with PINs and excludes the phantom', async () => {
  const def = buildPinsDoc(session, pairs);
  const text = JSON.stringify(def);
  for (const n of ['12', '34', '56', 'CONFIDENTIAL']) assert.ok(text.includes(n), n);
  assert.ok(!text.includes('Pair 4'));
  const buf = await render(def);
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
});

test('fmtDate reads a local-midnight Date without shifting the day', () => {
  const { fmtDate } = require('../sheet-docs');
  assert.equal(fmtDate(new Date(2026, 9, 13)), '2026-10-13');   // local midnight, any time zone
  assert.equal(fmtDate('2026-10-13T00:00:00.000Z'), '2026-10-13');
});

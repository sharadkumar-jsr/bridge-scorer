'use strict';
// pdf-render.js — renders pdfmake document definitions to a Buffer.
// Kept separate from the route so it can be unit-tested without a database.
const PdfPrinter = require('pdfmake');
const { buildPinsDoc } = require('./sheet-docs');

const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica', bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique',
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

const pageCount = (buf) => (buf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;

// The PIN sheet is meant to be one page. Start at 24 pt and step the font down
// only if the names are long enough to spill onto a second page.
const PIN_FONT_SIZES = [24, 22, 20, 18, 16, 14, 12];

async function renderPinsOnePage(session, pairs) {
  let last = null;
  for (const size of PIN_FONT_SIZES) {
    last = { buf: await renderPdf(buildPinsDoc(session, pairs, size)), size };
    if (pageCount(last.buf) === 1) return last;
  }
  return last;   // extremely large/long case: smallest size, may run to a second page
}

module.exports = { renderPdf, pageCount, renderPinsOnePage, PIN_FONT_SIZES };

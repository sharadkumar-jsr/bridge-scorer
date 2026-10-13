'use strict';
// sheet-docs.js — pdfmake document definitions for the two printable sheets.
// Pure functions (no database, no I/O) so they can be unit-tested.

const DARK = '#0b2a1a';
const GOLD = '#c9a03c';
const GREY = '#666666';
const BAND = '#f0f0e8';

// node-pg turns a DATE column into a JS Date at LOCAL midnight, so read it with
// local getters — toISOString() would shift the day in time zones ahead of UTC.
function fmtDate(d) {
  if (d instanceof Date) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  return String(d ?? '').slice(0, 10);
}

const displayName = (p, num) => {
  const names = [p?.player1_name, p?.player2_name].filter(Boolean);
  return names.length ? names.join('  &  ') : null;
};

function header(title, session, subtitle) {
  const date = fmtDate(session.date);
  return [
    { text: session.name, fontSize: 20, bold: true, color: DARK },
    { text: `${date}  ·  ${session.tables_count} tables`, fontSize: 10, color: GREY, margin: [0, 2, 0, 10] },
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 3, color: GOLD }], margin: [0, 0, 0, 10] },
    { text: title, fontSize: 18, bold: true, margin: [0, 0, 0, subtitle ? 2 : 10] },
    ...(subtitle ? [{ text: subtitle, fontSize: 10, color: GREY, margin: [0, 0, 0, 10] }] : []),
  ];
}

/**
 * Round-1 table sheet to circulate to players.
 *
 * @param {Object} session   { name, date, tables_count }
 * @param {Array}  pairs     session_pairs rows: { pair_number, player1_name, player2_name, is_phantom }
 * @param {Array}  tables    round-1 rows: { table_number, ns_pair, ew_pair, is_bye, boards:number[] }
 */
function buildTablesDoc(session, pairs, tables) {
  const byNum = {};
  for (const p of pairs) byNum[p.pair_number] = p;

  const seatCell = (num) => {
    const p = byNum[num];
    if (!p || p.is_phantom) {
      return { text: 'BYE — no opponent, sit out this round', italics: true, color: GREY, fontSize: 11, margin: [0, 6, 0, 6] };
    }
    const names = displayName(p);
    return {
      stack: [
        { text: `Pair ${num}`, bold: true, fontSize: 13 },
        { text: names ?? '(names not entered)', fontSize: 12, color: names ? '#000' : GREY },
      ],
      margin: [0, 3, 0, 3],
    };
  };

  const head = (t, extra = {}) => ({ text: t, bold: true, color: GOLD, fillColor: DARK, fontSize: 11, ...extra });

  const body = [[
    head('Table', { alignment: 'center' }), head('North – South'), head('East – West'),
    head('Boards', { alignment: 'center' }),
  ]];

  tables.forEach((t, i) => {
    const fill = i % 2 === 0 ? BAND : '#ffffff';
    const sittingOut = t.is_bye;
    body.push([
      { text: String(t.table_number), bold: true, fontSize: 22, alignment: 'center', fillColor: fill, margin: [0, 6, 0, 0] },
      { ...seatCell(t.ns_pair), fillColor: fill },
      { ...seatCell(t.ew_pair), fillColor: fill },
      {
        text: sittingOut ? '—' : formatBoards(t.boards),
        alignment: 'center', fontSize: 11, fillColor: fill, margin: [0, 10, 0, 0],
      },
    ]);
  });

  const content = [
    ...header('Round 1 — Table Assignments', session,
      'Find your name, go to your table and take the seat shown. Pair numbers stay the same all evening.'),
    {
      table: { headerRows: 1, widths: [50, '*', '*', 60], body },
      layout: {
        hLineColor: () => '#cccccc', vLineColor: () => '#cccccc',
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 3, paddingBottom: () => 3,
      },
    },
  ];

  return docDefaults(content, 'Good luck and enjoy the game!');
}

/**
 * PIN sheet — director only. Big, bold, centred table: Pair No. | Pair name | PIN.
 * Font size scales with the number of pairs so the sheet stays on one page.
 * @param {Array} pairs  session_pairs rows incl. pin
 */
function buildPinsDoc(session, pairs) {
  const real = pairs.filter(p => !p.is_phantom).sort((a, b) => a.pair_number - b.pair_number);
  const n = real.length;
  const size = n <= 8 ? 28 : n <= 11 ? 24 : 20;      // body font
  const pad  = n <= 8 ? 9  : n <= 11 ? 7  : 5;       // vertical padding per row

  const cell = (text, extra = {}) => ({
    text, bold: true, alignment: 'center', fontSize: size, ...extra,
  });

  const content = [
    { text: session.name, fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
    { text: 'Pair PIN Codes  —  Director copy, do not circulate', fontSize: 11, bold: true,
      color: '#b00020', alignment: 'center', margin: [0, 0, 0, 14] },
    {
      table: {
        headerRows: 1, widths: [size >= 28 ? 150 : size >= 24 ? 130 : 105, '*', size >= 28 ? 100 : 80],
        body: [
          [cell('Pair No.'), cell('Pair name'), cell('PIN')],
          ...real.map(p => [
            cell(String(p.pair_number)),
            cell(displayName(p) ? displayName(p).replace(/\s{2,}&\s{2,}/, ' & ') : '(names not entered)',
                 displayName(p) ? {} : { bold: false, italics: true, color: GREY }),
            cell(p.pin ?? '—'),
          ]),
        ],
      },
      layout: {
        hLineColor: () => '#000000', vLineColor: () => '#000000',
        hLineWidth: () => 1, vLineWidth: () => 1,
        paddingTop: () => pad, paddingBottom: () => pad, paddingLeft: () => 8, paddingRight: () => 8,
      },
    },
  ];
  return docDefaults(content, 'Keep this sheet private — anyone with a PIN can enter scores for that pair.');
}

function docDefaults(content, footerNote) {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    content,
    footer: () => ({ text: footerNote, fontSize: 8, color: '#888888', alignment: 'center', margin: [0, 15, 0, 0] }),
  };
}

// [1,2,3,5,6] → "1–3, 5–6"
function formatBoards(boards) {
  const b = [...new Set(boards ?? [])].sort((x, y) => x - y);
  if (!b.length) return '—';
  const out = [];
  let start = b[0], prev = b[0];
  for (let i = 1; i <= b.length; i++) {
    if (b[i] === prev + 1) { prev = b[i]; continue; }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = b[i];
  }
  return out.join(', ');
}

module.exports = { buildTablesDoc, buildPinsDoc, formatBoards, fmtDate };

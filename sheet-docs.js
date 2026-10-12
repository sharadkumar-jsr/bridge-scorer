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

  // Alphabetical "find your seat" list — quickest way for a player to locate themselves.
  const seatOf = {};
  for (const t of tables) {
    seatOf[t.ns_pair] = { table: t.table_number, side: 'North – South', bye: t.is_bye };
    seatOf[t.ew_pair] = { table: t.table_number, side: 'East – West',  bye: t.is_bye };
  }
  const people = [];
  for (const p of pairs) {
    if (p.is_phantom) continue;
    const seat = seatOf[p.pair_number];
    if (!seat) continue;
    for (const n of [p.player1_name, p.player2_name]) {
      if (n && n.trim()) people.push({ name: n.trim(), pair: p.pair_number, ...seat });
    }
  }
  people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  if (people.length) {
    const h = (t, extra = {}) => ({ text: t, bold: true, color: GOLD, fillColor: DARK, fontSize: 10, ...extra });
    content.push(
      { text: 'Find your seat (A – Z)', fontSize: 15, bold: true, margin: [0, 0, 0, 8], pageBreak: 'before' },
      {
        table: {
          headerRows: 1, widths: ['*', 40, 45, 110],
          body: [
            [h('Player'), h('Pair', { alignment: 'center' }), h('Table', { alignment: 'center' }), h('Seat')],
            ...people.map((x, i) => {
              const fill = i % 2 === 0 ? BAND : '#ffffff';
              return [
                { text: x.name, fontSize: 11, fillColor: fill },
                { text: String(x.pair), alignment: 'center', fontSize: 11, fillColor: fill },
                { text: x.bye ? '—' : String(x.table), alignment: 'center', bold: true, fontSize: 12, fillColor: fill },
                { text: x.bye ? 'Sitting out (bye)' : x.side, fontSize: 11, fillColor: fill },
              ];
            }),
          ],
        },
        layout: {
          hLineColor: () => '#cccccc', vLineColor: () => '#cccccc', hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          paddingTop: () => 3, paddingBottom: () => 3,
        },
      },
    );
  }

  return docDefaults(content, 'Good luck and enjoy the game!');
}

/**
 * PIN sheet — director only.
 * @param {Array} pairs  session_pairs rows incl. pin
 */
function buildPinsDoc(session, pairs) {
  const real = pairs.filter(p => !p.is_phantom).sort((a, b) => a.pair_number - b.pair_number);
  const h = (t, extra = {}) => ({ text: t, bold: true, color: GOLD, fillColor: DARK, fontSize: 11, ...extra });

  const content = [
    ...header('Pair PIN Codes', session,
      'Players log in through the invite link by choosing their pair number and typing their 2-digit PIN.'),
    {
      text: 'CONFIDENTIAL — for the director only. Do not circulate this sheet to players.',
      bold: true, color: '#b00020', fontSize: 11, margin: [0, 0, 0, 10],
    },
    {
      table: {
        headerRows: 1, widths: [45, '*', 80],
        body: [
          [h('Pair', { alignment: 'center' }), h('Players'), h('PIN', { alignment: 'center' })],
          ...real.map((p, i) => {
            const fill = i % 2 === 0 ? BAND : '#ffffff';
            const names = displayName(p);
            return [
              { text: String(p.pair_number), alignment: 'center', bold: true, fontSize: 14, fillColor: fill, margin: [0, 4, 0, 0] },
              { text: names ?? '(names not entered)', fontSize: 13, color: names ? '#000' : GREY, fillColor: fill, margin: [0, 3, 0, 0] },
              { text: p.pin ?? '—', alignment: 'center', font: 'Courier', bold: true, fontSize: 24, fillColor: fill },
            ];
          }),
        ],
      },
      layout: {
        hLineColor: () => '#cccccc', vLineColor: () => '#cccccc', hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        paddingTop: () => 4, paddingBottom: () => 4,
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

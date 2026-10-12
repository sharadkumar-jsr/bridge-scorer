'use strict';
// csv-util.js — dependency-free CSV helpers (kept separate from the route so they
// can be unit-tested without opening a database connection).

function cell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // A leading = + - @ (or tab/CR) would be treated as a formula by spreadsheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  // BOM so Excel detects UTF-8 (names may contain non-ASCII characters)
  return '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { cell, toCsv };

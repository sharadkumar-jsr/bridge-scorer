'use strict';
// validation.js — shared input validation for board score entry.
// Returns clean, correctly-typed values or a human-readable error, so bad
// input produces a 400 instead of a DB CHECK-constraint failure (500).

const DECLARERS = ['N', 'S', 'E', 'W'];
const SUITS     = ['C', 'D', 'H', 'S', 'NT'];
const DOUBLED   = ['none', 'doubled', 'redoubled'];

/**
 * @param {Object}  body
 * @param {Object}  [opts]
 * @param {boolean} [opts.allowPassedOut=false]  accept level 0 (director only)
 * @returns {{ ok: true, value: {declarer,level,suit,doubled,tricks,passedOut} }
 *          | { ok: false, error: string }}
 */
function validateBoardEntry(body, { allowPassedOut = false } = {}) {
  const b = body ?? {};
  const level = Number(b.level);

  if (b.level == null || !Number.isInteger(level) || level < 0 || level > 7) {
    return { ok: false, error: 'level must be a whole number from 1 to 7' };
  }

  if (level === 0) {
    if (!allowPassedOut) {
      return { ok: false, error: 'level must be a whole number from 1 to 7' };
    }
    return {
      ok: true,
      value: { declarer: 'N', level: 0, suit: 'NT', doubled: 'none', tricks: 0, passedOut: true },
    };
  }

  const declarer = typeof b.declarer === 'string' ? b.declarer.toUpperCase() : '';
  if (!DECLARERS.includes(declarer)) {
    return { ok: false, error: 'declarer must be one of N, S, E, W' };
  }

  const suit = typeof b.suit === 'string' ? b.suit.toUpperCase() : '';
  if (!SUITS.includes(suit)) {
    return { ok: false, error: 'suit must be one of C, D, H, S, NT' };
  }

  const doubled = b.doubled ?? 'none';
  if (!DOUBLED.includes(doubled)) {
    return { ok: false, error: 'doubled must be none, doubled or redoubled' };
  }

  const tricks = Number(b.tricks);
  if (b.tricks == null || b.tricks === '' || !Number.isInteger(tricks) || tricks < 0 || tricks > 13) {
    return { ok: false, error: 'tricks must be a whole number from 0 to 13' };
  }

  return { ok: true, value: { declarer, level, suit, doubled, tricks, passedOut: false } };
}

module.exports = { validateBoardEntry, DECLARERS, SUITS, DOUBLED };

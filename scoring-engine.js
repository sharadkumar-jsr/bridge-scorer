'use strict';
// ============================================================
//  scoring-engine.js
//  ACBL Duplicate Bridge Scoring Engine  — Phase 1
//  Pure JS module, zero dependencies, fully testable.
// ============================================================

// ----------------------------------------------------------
// SECTION 1 — VULNERABILITY
// ----------------------------------------------------------

/**
 * Standard 16-board vulnerability cycle (ACBL / WBF).
 * Index = (boardNumber - 1) % 16
 */
const VUL_CYCLE = [
  'none', 'ns',   'ew',   'both',  // boards  1–4
  'ns',   'ew',   'both', 'none',  // boards  5–8
  'ew',   'both', 'none', 'ns',    // boards  9–12
  'both', 'none', 'ns',   'ew',    // boards 13–16
];

/**
 * Returns the vulnerability string for a board number.
 * Cycles every 16 boards.
 * @param {number} boardNumber – 1-indexed
 * @returns {'none'|'ns'|'ew'|'both'}
 */
function getVulnerability(boardNumber) {
  if (!Number.isInteger(boardNumber) || boardNumber < 1) {
    throw new Error(`Invalid board number: ${boardNumber}`);
  }
  return VUL_CYCLE[(boardNumber - 1) % 16];
}

/**
 * Returns whether the declaring side is vulnerable.
 * @param {'ns'|'ew'} declarerSide
 * @param {'none'|'ns'|'ew'|'both'} vulnerability
 * @returns {boolean}
 */
function isVulnerable(declarerSide, vulnerability) {
  if (vulnerability === 'both') return true;
  if (vulnerability === 'none') return false;
  return vulnerability === declarerSide;
}

// ----------------------------------------------------------
// SECTION 2 — RAW SCORE CALCULATION
// ----------------------------------------------------------

/**
 * Base trick score for the BID level only (not overtricks).
 * Doubles/redoubles the suit base value.
 */
function _baseTrickScore(level, suit, doubled) {
  let score;
  if (suit === 'NT')              score = 10 + 30 * level;  // 40/70/100…
  else if (suit === 'H' || suit === 'S') score = 30 * level;
  else                            score = 20 * level;        // C / D

  if (doubled === 'doubled')   score *= 2;
  if (doubled === 'redoubled') score *= 4;
  return score;
}

/** Per-overtrick value. */
function _overtrickValue(suit, doubled, vul) {
  if (doubled === 'none')       return (suit === 'C' || suit === 'D') ? 20 : 30;
  if (doubled === 'doubled')    return vul ? 200 : 100;
  /* redoubled */               return vul ? 400 : 200;
}

/**
 * ACBL undertrick penalty table — returns a NEGATIVE number.
 * Undoubled NV: 50/trick   Undoubled V: 100/trick
 * Doubled NV:   100 / 200 / 200 / 300 / 300 / 300 …
 * Doubled V:    200 / 300 / 300 / 300 …
 * Redoubled:    2 × doubled
 */
function _undertrickPenalty(undertricks, doubled, vul) {
  if (doubled === 'none') {
    return -(vul ? 100 : 50) * undertricks;
  }

  const mult = doubled === 'redoubled' ? 2 : 1;
  let penalty = 0;
  for (let i = 1; i <= undertricks; i++) {
    if (vul) {
      penalty += (i === 1 ? 200 : 300) * mult;
    } else {
      let base;
      if (i === 1)       base = 100;
      else if (i <= 3)   base = 200;
      else               base = 300;
      penalty += base * mult;
    }
  }
  return -penalty;
}

/**
 * Calculate ACBL raw score from the NS perspective.
 *
 * @param {Object} p
 * @param {'N'|'S'|'E'|'W'}           p.declarer
 * @param {number}                     p.level      – 1–7, or 0 = passed out
 * @param {'C'|'D'|'H'|'S'|'NT'|null} p.suit       – null if passed out
 * @param {'none'|'doubled'|'redoubled'} p.doubled  – default 'none'
 * @param {number}                     p.tricks     – tricks made by declarer
 * @param {number}                     p.boardNumber
 *
 * @returns {number}  positive → NS scores,  negative → EW scores
 */
function calculateRawScore({
  declarer,
  level,
  suit,
  doubled = 'none',
  tricks,
  boardNumber,
}) {
  // ---- Passed-out board ----------------------------------------
  if (level === 0 || !suit) return 0;

  // ---- Setup ---------------------------------------------------
  const declaringNS = declarer === 'N' || declarer === 'S';
  const vul = isVulnerable(
    declaringNS ? 'ns' : 'ew',
    getVulnerability(boardNumber)
  );

  const needed = 6 + level;
  const result = tricks - needed;   // ≥ 0 = made, < 0 = down

  let score;

  if (result >= 0) {
    // ---- CONTRACT MADE -----------------------------------------
    const trickScore  = _baseTrickScore(level, suit, doubled);
    const isGame      = trickScore >= 100;
    const isSmallSlam = level === 6;
    const isGrandSlam = level === 7;

    score = trickScore;
    score += result * _overtrickValue(suit, doubled, vul);   // overtricks

    // Insult bonus (making a doubled / redoubled contract)
    if (doubled === 'doubled')   score += 50;
    if (doubled === 'redoubled') score += 100;

    // Part-score / Game / Slam bonuses
    if (!isGame) {
      score += 50;                              // part-score bonus
    } else {
      score += vul ? 500 : 300;                 // game bonus
    }
    if (isSmallSlam)  score += vul ? 750  : 500;   // slam bonus ON TOP of game
    if (isGrandSlam)  score += vul ? 1500 : 1000;  // grand slam on top of game

  } else {
    // ---- CONTRACT DEFEATED -------------------------------------
    score = _undertrickPenalty(-result, doubled, vul);
  }

  // EW declared → flip sign so we always return NS perspective
  return declaringNS ? score : -score;
}

// ----------------------------------------------------------
// SECTION 3 — MATCHPOINT CALCULATION (single board)
// ----------------------------------------------------------

/**
 * Calculate matchpoints for every pair on one board.
 *
 * @param {Array<{
 *   pairNS : number,
 *   pairEW : number,
 *   nsScore: number,
 *   isBye? : boolean
 * }>} results
 *
 * @returns {{ [pairNum]: { mp: number, maxMp: number, isBye?: boolean } }}
 */
function calculateMatchpoints(results) {
  const played   = results.filter(r => !r.isBye);
  const byes     = results.filter(r =>  r.isBye);
  const n        = played.length;
  const maxMp    = Math.max(0, (n - 1) * 2);
  const avgMp    = maxMp / 2;               // 50 % of max for bye pairs

  const out = {};

  for (const r of played) {
    let nsMP = 0;
    let ewMP = 0;
    for (const other of played) {
      if (other === r) continue;
      // NS: higher nsScore is better
      if      (r.nsScore > other.nsScore) nsMP += 2;
      else if (r.nsScore === other.nsScore) nsMP += 1;
      // EW: LOWER nsScore is better for EW
      if      (r.nsScore < other.nsScore) ewMP += 2;
      else if (r.nsScore === other.nsScore) ewMP += 1;
    }
    out[r.pairNS] = { mp: nsMP, maxMp };
    out[r.pairEW] = { mp: ewMP, maxMp };
  }

  // Bye pairs receive average score (real pairNS; phantom pairEW not scored)
  for (const r of byes) {
    out[r.pairNS] = { mp: avgMp, maxMp, isBye: true };
  }

  return out;
}

// ----------------------------------------------------------
// SECTION 4 — FULL SESSION RESULTS
// ----------------------------------------------------------

/**
 * Aggregate matchpoints across all boards and produce final rankings.
 *
 * @param {Object} session
 * @param {number[]} session.pairs   – real pair numbers (phantom excluded)
 * @param {Array<{
 *   boardNumber: number,
 *   results: Array<{
 *     pairNS   : number,
 *     pairEW   : number,
 *     declarer : string,
 *     level    : number,
 *     suit     : string,
 *     doubled  : string,
 *     tricks   : number,
 *     isBye?   : boolean
 *   }>
 * }>} session.boards
 *
 * @returns {Array<{
 *   rank: number, pairNumber: number,
 *   totalMP: number, maxMP: number, percentage: string
 * }>} sorted by percentage descending
 */
function calculateSessionResults(session) {
  const totals = {};
  for (const p of session.pairs) totals[p] = { totalMP: 0, maxMP: 0 };

  for (const board of session.boards) {
    // Enrich non-bye results with nsScore
    const enriched = board.results.map(r =>
      r.isBye
        ? { ...r }
        : {
            ...r,
            nsScore: calculateRawScore({
              declarer:    r.declarer,
              level:       r.level,
              suit:        r.suit,
              doubled:     r.doubled ?? 'none',
              tricks:      r.tricks,
              boardNumber: board.boardNumber,
            }),
          }
    );

    const boardMP = calculateMatchpoints(enriched);

    for (const [key, data] of Object.entries(boardMP)) {
      const p = Number(key);
      if (totals[p] !== undefined) {
        totals[p].totalMP += data.mp;
        totals[p].maxMP   += data.maxMp;
      }
    }
  }

  // Build and sort the rankings
  const rows = session.pairs.map(p => ({
    pairNumber:  p,
    totalMP:     totals[p].totalMP,
    maxMP:       totals[p].maxMP,
    percentage:  totals[p].maxMP > 0
                   ? ((totals[p].totalMP / totals[p].maxMP) * 100).toFixed(2)
                   : '0.00',
  }));

  rows.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].percentage !== rows[i - 1].percentage) rank = i + 1;
    rows[i].rank = rank;
  }

  return rows;
}

// ----------------------------------------------------------
// SECTION 5 — EXPORTS
// ----------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getVulnerability,
    isVulnerable,
    calculateRawScore,
    calculateMatchpoints,
    calculateSessionResults,
  };
}

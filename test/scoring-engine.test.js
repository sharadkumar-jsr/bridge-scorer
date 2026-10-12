'use strict';
// Run with:  npm test   (uses Node's built-in test runner, Node >= 18)
const test   = require('node:test');
const assert = require('node:assert/strict');
const {
  getVulnerability, calculateRawScore, calculateMatchpoints, calculateSessionResults,
} = require('../scoring-engine');
const { validateBoardEntry } = require('../validation');

// Board 1 = nobody vul, board 2 = NS vul, board 3 = EW vul, board 4 = both vul
const NV = 1, NS_VUL = 2, EW_VUL = 3, BOTH = 4;
const score = (declarer, level, suit, tricks, boardNumber, doubled = 'none') =>
  calculateRawScore({ declarer, level, suit, doubled, tricks, boardNumber });

test('vulnerability cycle repeats every 16 boards', () => {
  assert.equal(getVulnerability(1), 'none');
  assert.equal(getVulnerability(2), 'ns');
  assert.equal(getVulnerability(3), 'ew');
  assert.equal(getVulnerability(4), 'both');
  assert.equal(getVulnerability(17), 'none');
  assert.throws(() => getVulnerability(0));
});

test('part-score, game and slam values (made exactly)', () => {
  assert.equal(score('N', 1, 'NT', 7, NV), 90);
  assert.equal(score('N', 2, 'S', 8, NV), 110);
  assert.equal(score('N', 3, 'NT', 9, NV), 400);
  assert.equal(score('N', 3, 'NT', 9, NS_VUL), 600);
  assert.equal(score('N', 4, 'H', 10, NV), 420);
  assert.equal(score('N', 4, 'H', 10, NS_VUL), 620);
  assert.equal(score('N', 5, 'C', 11, NV), 400);
  assert.equal(score('N', 6, 'S', 12, NV), 980);
  assert.equal(score('N', 6, 'NT', 12, NS_VUL), 1440);
  assert.equal(score('N', 7, 'NT', 13, NV), 1520);
  assert.equal(score('N', 7, 'S', 13, NS_VUL), 2210);
});

test('overtricks', () => {
  assert.equal(score('N', 4, 'S', 11, NV), 450);
  assert.equal(score('N', 4, 'S', 12, NS_VUL), 680);
  assert.equal(score('N', 3, 'D', 11, NV), 110 + 40);        // minor overtricks 20 each
});

test('doubled and redoubled contracts made', () => {
  // 2H doubled making exactly NV: 120 trick + 300 game + 50 insult
  assert.equal(score('N', 2, 'H', 8, NV, 'doubled'), 470);
  // 1NT doubled making exactly NV: 80 + 50 part-score + 50 insult
  assert.equal(score('N', 1, 'NT', 7, NV, 'doubled'), 180);
  // 2H doubled + 1 overtrick NV: 470 + 100
  assert.equal(score('N', 2, 'H', 9, NV, 'doubled'), 570);
  // 2H doubled + 1 overtrick Vul: 120 + 500 + 50 + 200
  assert.equal(score('N', 2, 'H', 9, NS_VUL, 'doubled'), 870);
  // 1C redoubled making exactly NV: 80 + 50 part-score + 100 insult
  assert.equal(score('N', 1, 'C', 7, NV, 'redoubled'), 230);
});

test('undertricks — undoubled', () => {
  assert.equal(score('N', 4, 'S', 9, NV), -50);
  assert.equal(score('N', 4, 'S', 8, NV), -100);
  assert.equal(score('N', 4, 'S', 9, NS_VUL), -100);
  assert.equal(score('N', 4, 'S', 7, NS_VUL), -300);
});

test('undertricks — doubled and redoubled', () => {
  // NV doubled: 100, 300, 500, 800 cumulative
  assert.equal(score('N', 4, 'S', 9, NV, 'doubled'), -100);
  assert.equal(score('N', 4, 'S', 8, NV, 'doubled'), -300);
  assert.equal(score('N', 4, 'S', 7, NV, 'doubled'), -500);
  assert.equal(score('N', 4, 'S', 6, NV, 'doubled'), -800);
  // Vul doubled: 200, 500, 800
  assert.equal(score('N', 4, 'S', 9, NS_VUL, 'doubled'), -200);
  assert.equal(score('N', 4, 'S', 8, NS_VUL, 'doubled'), -500);
  assert.equal(score('N', 4, 'S', 7, NS_VUL, 'doubled'), -800);
  // Redoubled doubles the doubled penalty
  assert.equal(score('N', 4, 'S', 9, NV, 'redoubled'), -200);
  assert.equal(score('N', 4, 'S', 8, NS_VUL, 'redoubled'), -1000);
});

test('East/West declarer flips the sign (NS perspective)', () => {
  assert.equal(score('E', 4, 'S', 10, NV), -420);
  assert.equal(score('W', 4, 'S', 10, EW_VUL), -620);
  assert.equal(score('E', 4, 'S', 9, NV), 50);
  // vulnerability follows the declaring side
  assert.equal(score('E', 3, 'NT', 9, NS_VUL), -400);
  assert.equal(score('E', 3, 'NT', 9, BOTH), -600);
});

test('passed-out board scores zero', () => {
  assert.equal(calculateRawScore({ declarer: 'N', level: 0, suit: null, tricks: 0, boardNumber: 1 }), 0);
});

test('matchpoints: top, bottom, tie and zero-sum', () => {
  const mp = calculateMatchpoints([
    { pairNS: 1, pairEW: 2, nsScore: 420 },
    { pairNS: 3, pairEW: 4, nsScore: 420 },
    { pairNS: 5, pairEW: 6, nsScore: -50 },
  ]);
  assert.deepEqual(mp[1], { mp: 3, maxMp: 4 });
  assert.deepEqual(mp[3], { mp: 3, maxMp: 4 });
  assert.deepEqual(mp[5], { mp: 0, maxMp: 4 });
  assert.deepEqual(mp[6], { mp: 4, maxMp: 4 });
  assert.equal(mp[1].mp + mp[2].mp, mp[1].maxMp);   // NS + EW on one row sum to the max
});

test('matchpoints: byes are ignored and maximums stay equal', () => {
  const mp = calculateMatchpoints([
    { pairNS: 1, pairEW: 2, nsScore: 100 },
    { pairNS: 3, pairEW: 4, nsScore: 200 },
    { pairNS: 5, pairEW: 6, nsScore: 0, isBye: true },
  ]);
  assert.equal(mp[5], undefined);
  assert.equal(mp[6], undefined);
  assert.equal(mp[1].maxMp, 2);
  assert.equal(mp[3].maxMp, 2);
});

test('session results: ranking and percentages', () => {
  const res = calculateSessionResults({
    pairs: [1, 2, 3, 4],
    boards: [
      { boardNumber: 1, results: [
        { pairNS: 1, pairEW: 2, declarer: 'N', level: 4, suit: 'S', tricks: 10 },
        { pairNS: 3, pairEW: 4, declarer: 'N', level: 4, suit: 'S', tricks: 9 },
      ] },
    ],
  });
  const byPair = Object.fromEntries(res.map(r => [r.pairNumber, r]));
  assert.equal(byPair[1].rank, 1);
  assert.equal(byPair[1].percentage, '100.00');
  assert.equal(byPair[2].percentage, '0.00');
  assert.equal(byPair[4].percentage, '100.00');
  assert.equal(byPair[4].rank, 1);                  // ties share a rank
  assert.equal(byPair[3].rank, 3);
});

test('validateBoardEntry accepts good input and normalises case', () => {
  const r = validateBoardEntry({ declarer: 'n', level: '4', suit: 's', doubled: 'doubled', tricks: '10' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { declarer: 'N', level: 4, suit: 'S', doubled: 'doubled', tricks: 10, passedOut: false });
});

test('validateBoardEntry rejects out-of-range or malformed input', () => {
  const bad = [
    { declarer: 'N', level: 8, suit: 'S', tricks: 10 },
    { declarer: 'N', level: 4, suit: 'X', tricks: 10 },
    { declarer: 'Q', level: 4, suit: 'S', tricks: 10 },
    { declarer: 'N', level: 4, suit: 'S', tricks: 14 },
    { declarer: 'N', level: 4, suit: 'S', tricks: -1 },
    { declarer: 'N', level: 4, suit: 'S', tricks: 10.5 },
    { declarer: 'N', level: 4, suit: 'S', tricks: 10, doubled: 'maybe' },
    { declarer: 'N', suit: 'S', tricks: 10 },
    { declarer: 'N', level: 0, suit: 'S', tricks: 0 },         // pass-out not allowed for players
  ];
  for (const b of bad) assert.equal(validateBoardEntry(b).ok, false, JSON.stringify(b));
  assert.equal(validateBoardEntry({ level: 0 }, { allowPassedOut: true }).ok, true);
});

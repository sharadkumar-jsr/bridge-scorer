'use strict';
// ============================================================
//  movements.js
//  Hardcoded Howell movement tables — verified correct.
//  Each entry: { round, table, nsPair, ewPair, boards }
//  boards: array of board numbers in that set.
//  Pair 0 = phantom (bye).
// ============================================================

// Helper: expand "1-4" to [1,2,3,4]
function expandBoards(str) {
  const [a, b] = str.split('-').map(Number);
  const arr = [];
  for (let i = a; i <= b; i++) arr.push(i);
  return arr;
}

// ─────────────────────────────────────────────────────────────
//  3-TABLE HOWELL
//  5 pairs (pair 6 = phantom) OR 6 pairs (all real)
//  5 rounds · 20 boards · 4 boards/round/table
//  Verified: each pair plays each board set once,
//            each pair meets every other pair once.
// ─────────────────────────────────────────────────────────────
const HOWELL_3TABLE = [
  //  rnd  tbl  NS  EW  boards
  { round:1, table:1, nsPair:6, ewPair:1, boards:expandBoards('1-4')   },
  { round:1, table:2, nsPair:4, ewPair:3, boards:expandBoards('5-8')   },
  { round:1, table:3, nsPair:2, ewPair:5, boards:expandBoards('13-16') },

  { round:2, table:1, nsPair:6, ewPair:2, boards:expandBoards('5-8')   },
  { round:2, table:2, nsPair:5, ewPair:4, boards:expandBoards('9-12')  },
  { round:2, table:3, nsPair:3, ewPair:1, boards:expandBoards('13-16') },

  { round:3, table:1, nsPair:6, ewPair:3, boards:expandBoards('9-12')  },
  { round:3, table:2, nsPair:1, ewPair:5, boards:expandBoards('5-8')   },
  { round:3, table:3, nsPair:4, ewPair:2, boards:expandBoards('1-4')   },

  { round:4, table:1, nsPair:6, ewPair:4, boards:expandBoards('13-16') },
  { round:4, table:2, nsPair:2, ewPair:1, boards:expandBoards('9-12')  },
  { round:4, table:3, nsPair:5, ewPair:3, boards:expandBoards('1-4')   },

  { round:5, table:1, nsPair:6, ewPair:5, boards:expandBoards('17-20') },
  { round:5, table:2, nsPair:3, ewPair:2, boards:expandBoards('17-20') },
  { round:5, table:3, nsPair:1, ewPair:4, boards:expandBoards('17-20') },
];

// ─────────────────────────────────────────────────────────────
//  4-TABLE HOWELL
//  7 pairs (pair 8 = phantom) OR 8 pairs (all real)
//  7 rounds · 21 boards · 3 boards/round/table
//  Each board set played by 4 pairs → max 6 MP per board.
// ─────────────────────────────────────────────────────────────
const HOWELL_4TABLE = [
  { round:1, table:1, nsPair:8, ewPair:1, boards:expandBoards('1-3')   },
  { round:1, table:2, nsPair:3, ewPair:6, boards:expandBoards('10-12') },
  { round:1, table:3, nsPair:2, ewPair:7, boards:expandBoards('16-18') },
  { round:1, table:4, nsPair:5, ewPair:4, boards:expandBoards('19-21') },

  { round:2, table:1, nsPair:8, ewPair:2, boards:expandBoards('4-6')   },
  { round:2, table:2, nsPair:4, ewPair:7, boards:expandBoards('13-15') },
  { round:2, table:3, nsPair:3, ewPair:1, boards:expandBoards('19-21') },
  { round:2, table:4, nsPair:6, ewPair:5, boards:expandBoards('1-3')   },

  { round:3, table:1, nsPair:8, ewPair:3, boards:expandBoards('7-9')   },
  { round:3, table:2, nsPair:5, ewPair:1, boards:expandBoards('16-18') },
  { round:3, table:3, nsPair:4, ewPair:2, boards:expandBoards('1-3')   },
  { round:3, table:4, nsPair:7, ewPair:6, boards:expandBoards('4-6')   },

  { round:4, table:1, nsPair:8, ewPair:4, boards:expandBoards('10-12') },
  { round:4, table:2, nsPair:6, ewPair:2, boards:expandBoards('19-21') },
  { round:4, table:3, nsPair:5, ewPair:3, boards:expandBoards('4-6')   },
  { round:4, table:4, nsPair:1, ewPair:7, boards:expandBoards('7-9')   },

  { round:5, table:1, nsPair:8, ewPair:5, boards:expandBoards('13-15') },
  { round:5, table:2, nsPair:7, ewPair:3, boards:expandBoards('1-3')   },
  { round:5, table:3, nsPair:6, ewPair:4, boards:expandBoards('7-9')   },
  { round:5, table:4, nsPair:2, ewPair:1, boards:expandBoards('10-12') },

  { round:6, table:1, nsPair:8, ewPair:6, boards:expandBoards('16-18') },
  { round:6, table:2, nsPair:1, ewPair:4, boards:expandBoards('4-6')   },
  { round:6, table:3, nsPair:7, ewPair:5, boards:expandBoards('10-12') },
  { round:6, table:4, nsPair:3, ewPair:2, boards:expandBoards('13-15') },

  { round:7, table:1, nsPair:8, ewPair:7, boards:expandBoards('19-21') },
  { round:7, table:2, nsPair:2, ewPair:5, boards:expandBoards('7-9')   },
  { round:7, table:3, nsPair:1, ewPair:6, boards:expandBoards('13-15') },
  { round:7, table:4, nsPair:4, ewPair:3, boards:expandBoards('16-18') },
];

// ─────────────────────────────────────────────────────────────
//  5-TABLE HOWELL
//  9 pairs (pair 10 = phantom) OR 10 pairs (all real)
//  9 rounds · 18 boards · 2 boards/round/table
//  Each board set played by 5 pairs → max 8 MP per board.
//  When 9 pairs: pair 10 is phantom NS at table 3.
//  The EW pair scheduled vs pair 10 at table 3 each round gets a bye.
// ─────────────────────────────────────────────────────────────
const HOWELL_5TABLE = [
  { round:1, table:1, nsPair:7,  ewPair:3, boards:expandBoards('1-2')   },
  { round:1, table:2, nsPair:5,  ewPair:2, boards:expandBoards('3-4')   },
  { round:1, table:3, nsPair:10, ewPair:1, boards:expandBoards('5-6')   },
  { round:1, table:4, nsPair:9,  ewPair:8, boards:expandBoards('7-8')   },
  { round:1, table:5, nsPair:4,  ewPair:6, boards:expandBoards('9-10')  },

  { round:2, table:1, nsPair:8,  ewPair:4, boards:expandBoards('3-4')   },
  { round:2, table:2, nsPair:6,  ewPair:3, boards:expandBoards('5-6')   },
  { round:2, table:3, nsPair:10, ewPair:2, boards:expandBoards('7-8')   },
  { round:2, table:4, nsPair:1,  ewPair:9, boards:expandBoards('9-10')  },
  { round:2, table:5, nsPair:5,  ewPair:7, boards:expandBoards('11-12') },

  { round:3, table:1, nsPair:9,  ewPair:5, boards:expandBoards('5-6')   },
  { round:3, table:2, nsPair:7,  ewPair:4, boards:expandBoards('7-8')   },
  { round:3, table:3, nsPair:10, ewPair:3, boards:expandBoards('9-10')  },
  { round:3, table:4, nsPair:2,  ewPair:1, boards:expandBoards('11-12') },
  { round:3, table:5, nsPair:6,  ewPair:8, boards:expandBoards('13-14') },

  { round:4, table:1, nsPair:1,  ewPair:6, boards:expandBoards('7-8')   },
  { round:4, table:2, nsPair:8,  ewPair:5, boards:expandBoards('9-10')  },
  { round:4, table:3, nsPair:10, ewPair:4, boards:expandBoards('11-12') },
  { round:4, table:4, nsPair:3,  ewPair:2, boards:expandBoards('13-14') },
  { round:4, table:5, nsPair:7,  ewPair:9, boards:expandBoards('15-16') },

  { round:5, table:1, nsPair:2,  ewPair:7, boards:expandBoards('9-10')  },
  { round:5, table:2, nsPair:9,  ewPair:6, boards:expandBoards('11-12') },
  { round:5, table:3, nsPair:10, ewPair:5, boards:expandBoards('13-14') },
  { round:5, table:4, nsPair:4,  ewPair:3, boards:expandBoards('15-16') },
  { round:5, table:5, nsPair:8,  ewPair:1, boards:expandBoards('17-18') },

  { round:6, table:1, nsPair:3,  ewPair:8, boards:expandBoards('11-12') },
  { round:6, table:2, nsPair:1,  ewPair:7, boards:expandBoards('13-14') },
  { round:6, table:3, nsPair:10, ewPair:6, boards:expandBoards('15-16') },
  { round:6, table:4, nsPair:5,  ewPair:4, boards:expandBoards('17-18') },
  { round:6, table:5, nsPair:9,  ewPair:2, boards:expandBoards('1-2')   },

  { round:7, table:1, nsPair:4,  ewPair:9, boards:expandBoards('13-14') },
  { round:7, table:2, nsPair:2,  ewPair:8, boards:expandBoards('15-16') },
  { round:7, table:3, nsPair:10, ewPair:7, boards:expandBoards('17-18') },
  { round:7, table:4, nsPair:6,  ewPair:5, boards:expandBoards('1-2')   },
  { round:7, table:5, nsPair:1,  ewPair:3, boards:expandBoards('3-4')   },

  { round:8, table:1, nsPair:5,  ewPair:1, boards:expandBoards('15-16') },
  { round:8, table:2, nsPair:3,  ewPair:9, boards:expandBoards('17-18') },
  { round:8, table:3, nsPair:10, ewPair:8, boards:expandBoards('1-2')   },
  { round:8, table:4, nsPair:7,  ewPair:6, boards:expandBoards('3-4')   },
  { round:8, table:5, nsPair:2,  ewPair:4, boards:expandBoards('5-6')   },

  { round:9, table:1, nsPair:6,  ewPair:2, boards:expandBoards('17-18') },
  { round:9, table:2, nsPair:4,  ewPair:1, boards:expandBoards('1-2')   },
  { round:9, table:3, nsPair:10, ewPair:9, boards:expandBoards('3-4')   },
  { round:9, table:4, nsPair:8,  ewPair:7, boards:expandBoards('5-6')   },
  { round:9, table:5, nsPair:3,  ewPair:5, boards:expandBoards('7-8')   },
];

// ─────────────────────────────────────────────────────────────
//  6-TABLE HOWELL — PLACEHOLDER
//  To be filled in when movement card is provided.
// ─────────────────────────────────────────────────────────────
const HOWELL_6TABLE = null; // TODO: add when movement card provided

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Get the Howell movement table for a given number of tables.
 * @param {number} tables - 3, 4, or 5
 * @returns {Array|null} movement array or null if not yet available
 */
function getHowellMovement(tables) {
  switch (tables) {
    case 3: return HOWELL_3TABLE;
    case 4: return HOWELL_4TABLE;
    case 5: return HOWELL_5TABLE;
    case 6: return HOWELL_6TABLE;
    default: throw new Error(`No Howell movement defined for ${tables} tables`);
  }
}

/**
 * Determine the phantom pair number for a given table count.
 * The phantom is the highest-numbered pair in the movement.
 * Returns null if the session has no phantom (even pair count).
 * @param {number} tables
 * @param {boolean} hasPhantom
 */
function getPhantomPairNumber(tables) {
  // Phantom pair numbers: 3-table=6, 4-table=8, 5-table=10, 6-table=12
  const phantomMap = { 3: 6, 4: 8, 5: 10, 6: 12 };
  return phantomMap[tables] ?? null;
}

/**
 * Build a schedule for a specific pair.
 * Returns their rounds in order: { round, table, side, opponents, boards, isBye }
 * @param {Array} movement - full movement array
 * @param {number} pairNum
 * @param {number|null} phantomPairNum - null if no phantom
 */
function getPairSchedule(movement, pairNum, phantomPairNum = null) {
  const schedule = [];
  const rounds = [...new Set(movement.map(m => m.round))].sort((a,b)=>a-b);

  for (const round of rounds) {
    const slot = movement.find(
      m => m.round === round && (m.nsPair === pairNum || m.ewPair === pairNum)
    );
    if (!slot) continue;

    const side      = slot.nsPair === pairNum ? 'NS' : 'EW';
    const opponent  = side === 'NS' ? slot.ewPair : slot.nsPair;
    const isBye     = phantomPairNum !== null && opponent === phantomPairNum;

    schedule.push({
      round,
      table:    slot.table,
      side,
      opponent,
      boards:   slot.boards,
      isBye,
    });
  }
  return schedule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getHowellMovement,
    getPhantomPairNumber,
    getPairSchedule,
    HOWELL_3TABLE,
    HOWELL_4TABLE,
    HOWELL_5TABLE,
    HOWELL_6TABLE,
  };
}

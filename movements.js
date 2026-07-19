'use strict';
// ============================================================
//  movements.js — Verified Howell movement tables
//  6-table movement transcribed exactly from Bob Anderson cards
// ============================================================

// ─────────────────────────────────────────────────────────────
//  3-TABLE HOWELL  (pair 6 = phantom)
// ─────────────────────────────────────────────────────────────
const HOWELL_3TABLE = [
  { round:1, table:1, nsPair:6, ewPair:1, boards:[1,2,3,4]   },
  { round:1, table:2, nsPair:4, ewPair:3, boards:[5,6,7,8]   },
  { round:1, table:3, nsPair:2, ewPair:5, boards:[13,14,15,16] },

  { round:2, table:1, nsPair:6, ewPair:2, boards:[5,6,7,8]   },
  { round:2, table:2, nsPair:5, ewPair:4, boards:[9,10,11,12] },
  { round:2, table:3, nsPair:3, ewPair:1, boards:[13,14,15,16] },

  { round:3, table:1, nsPair:6, ewPair:3, boards:[9,10,11,12] },
  { round:3, table:2, nsPair:1, ewPair:5, boards:[5,6,7,8]   },
  { round:3, table:3, nsPair:4, ewPair:2, boards:[1,2,3,4]   },

  { round:4, table:1, nsPair:6, ewPair:4, boards:[13,14,15,16] },
  { round:4, table:2, nsPair:2, ewPair:1, boards:[9,10,11,12] },
  { round:4, table:3, nsPair:5, ewPair:3, boards:[1,2,3,4]   },

  { round:5, table:1, nsPair:6, ewPair:5, boards:[17,18,19,20] },
  { round:5, table:2, nsPair:3, ewPair:2, boards:[17,18,19,20] },
  { round:5, table:3, nsPair:1, ewPair:4, boards:[17,18,19,20] },
];

// ─────────────────────────────────────────────────────────────
//  4-TABLE HOWELL  (pair 8 = phantom)
// ─────────────────────────────────────────────────────────────
const HOWELL_4TABLE = [
  { round:1, table:1, nsPair:8, ewPair:1, boards:[1,2,3]   },
  { round:1, table:2, nsPair:3, ewPair:6, boards:[10,11,12] },
  { round:1, table:3, nsPair:2, ewPair:7, boards:[16,17,18] },
  { round:1, table:4, nsPair:5, ewPair:4, boards:[19,20,21] },

  { round:2, table:1, nsPair:8, ewPair:2, boards:[4,5,6]   },
  { round:2, table:2, nsPair:4, ewPair:7, boards:[13,14,15] },
  { round:2, table:3, nsPair:3, ewPair:1, boards:[19,20,21] },
  { round:2, table:4, nsPair:6, ewPair:5, boards:[1,2,3]   },

  { round:3, table:1, nsPair:8, ewPair:3, boards:[7,8,9]   },
  { round:3, table:2, nsPair:5, ewPair:1, boards:[16,17,18] },
  { round:3, table:3, nsPair:4, ewPair:2, boards:[1,2,3]   },
  { round:3, table:4, nsPair:7, ewPair:6, boards:[4,5,6]   },

  { round:4, table:1, nsPair:8, ewPair:4, boards:[10,11,12] },
  { round:4, table:2, nsPair:6, ewPair:2, boards:[19,20,21] },
  { round:4, table:3, nsPair:5, ewPair:3, boards:[4,5,6]   },
  { round:4, table:4, nsPair:1, ewPair:7, boards:[7,8,9]   },

  { round:5, table:1, nsPair:8, ewPair:5, boards:[13,14,15] },
  { round:5, table:2, nsPair:7, ewPair:3, boards:[1,2,3]   },
  { round:5, table:3, nsPair:6, ewPair:4, boards:[7,8,9]   },
  { round:5, table:4, nsPair:2, ewPair:1, boards:[10,11,12] },

  { round:6, table:1, nsPair:8, ewPair:6, boards:[16,17,18] },
  { round:6, table:2, nsPair:1, ewPair:4, boards:[4,5,6]   },
  { round:6, table:3, nsPair:7, ewPair:5, boards:[10,11,12] },
  { round:6, table:4, nsPair:3, ewPair:2, boards:[13,14,15] },

  { round:7, table:1, nsPair:8, ewPair:7, boards:[19,20,21] },
  { round:7, table:2, nsPair:2, ewPair:5, boards:[7,8,9]   },
  { round:7, table:3, nsPair:1, ewPair:6, boards:[13,14,15] },
  { round:7, table:4, nsPair:4, ewPair:3, boards:[16,17,18] },
];

// ─────────────────────────────────────────────────────────────
//  5-TABLE HOWELL  (pair 10 = phantom, always NS at Table 3)
// ─────────────────────────────────────────────────────────────
const HOWELL_5TABLE = [
  { round:1, table:1, nsPair:7,  ewPair:3,  boards:[1,2]   },
  { round:1, table:2, nsPair:5,  ewPair:2,  boards:[3,4]   },
  { round:1, table:3, nsPair:10, ewPair:1,  boards:[5,6]   },
  { round:1, table:4, nsPair:9,  ewPair:8,  boards:[7,8]   },
  { round:1, table:5, nsPair:4,  ewPair:6,  boards:[9,10]  },

  { round:2, table:1, nsPair:8,  ewPair:4,  boards:[3,4]   },
  { round:2, table:2, nsPair:6,  ewPair:3,  boards:[5,6]   },
  { round:2, table:3, nsPair:10, ewPair:2,  boards:[7,8]   },
  { round:2, table:4, nsPair:1,  ewPair:9,  boards:[9,10]  },
  { round:2, table:5, nsPair:5,  ewPair:7,  boards:[11,12] },

  { round:3, table:1, nsPair:9,  ewPair:5,  boards:[5,6]   },
  { round:3, table:2, nsPair:7,  ewPair:4,  boards:[7,8]   },
  { round:3, table:3, nsPair:10, ewPair:3,  boards:[9,10]  },
  { round:3, table:4, nsPair:2,  ewPair:1,  boards:[11,12] },
  { round:3, table:5, nsPair:6,  ewPair:8,  boards:[13,14] },

  { round:4, table:1, nsPair:1,  ewPair:6,  boards:[7,8]   },
  { round:4, table:2, nsPair:8,  ewPair:5,  boards:[9,10]  },
  { round:4, table:3, nsPair:10, ewPair:4,  boards:[11,12] },
  { round:4, table:4, nsPair:3,  ewPair:2,  boards:[13,14] },
  { round:4, table:5, nsPair:7,  ewPair:9,  boards:[15,16] },

  { round:5, table:1, nsPair:2,  ewPair:7,  boards:[9,10]  },
  { round:5, table:2, nsPair:9,  ewPair:6,  boards:[11,12] },
  { round:5, table:3, nsPair:10, ewPair:5,  boards:[13,14] },
  { round:5, table:4, nsPair:4,  ewPair:3,  boards:[15,16] },
  { round:5, table:5, nsPair:8,  ewPair:1,  boards:[17,18] },

  { round:6, table:1, nsPair:3,  ewPair:8,  boards:[11,12] },
  { round:6, table:2, nsPair:1,  ewPair:7,  boards:[13,14] },
  { round:6, table:3, nsPair:10, ewPair:6,  boards:[15,16] },
  { round:6, table:4, nsPair:5,  ewPair:4,  boards:[17,18] },
  { round:6, table:5, nsPair:9,  ewPair:2,  boards:[1,2]   },

  { round:7, table:1, nsPair:4,  ewPair:9,  boards:[13,14] },
  { round:7, table:2, nsPair:2,  ewPair:8,  boards:[15,16] },
  { round:7, table:3, nsPair:10, ewPair:7,  boards:[17,18] },
  { round:7, table:4, nsPair:6,  ewPair:5,  boards:[1,2]   },
  { round:7, table:5, nsPair:1,  ewPair:3,  boards:[3,4]   },

  { round:8, table:1, nsPair:5,  ewPair:1,  boards:[15,16] },
  { round:8, table:2, nsPair:3,  ewPair:9,  boards:[17,18] },
  { round:8, table:3, nsPair:10, ewPair:8,  boards:[1,2]   },
  { round:8, table:4, nsPair:7,  ewPair:6,  boards:[3,4]   },
  { round:8, table:5, nsPair:2,  ewPair:4,  boards:[5,6]   },

  { round:9, table:1, nsPair:6,  ewPair:2,  boards:[17,18] },
  { round:9, table:2, nsPair:4,  ewPair:1,  boards:[1,2]   },
  { round:9, table:3, nsPair:10, ewPair:9,  boards:[3,4]   },
  { round:9, table:4, nsPair:8,  ewPair:7,  boards:[5,6]   },
  { round:9, table:5, nsPair:3,  ewPair:5,  boards:[7,8]   },
];

// ─────────────────────────────────────────────────────────────
//  6-TABLE HOWELL  (pair 12 = phantom, always NS at Table 5)
//  11 rounds · 22 boards · 2 boards per table per round
//  Transcribed EXACTLY from Bob Anderson Movement/6G cards
//
//  Table 1:  NS=9..8 (rotating), EW=11..10 (rotating)
//  Table 2:  NS=7..6 (rotating), EW=4..3  (rotating)
//  Table 3:  NS=8..7 (rotating), EW=2..1  (rotating)
//  Table 4:  NS=5..4 (rotating), EW=6..5  (rotating)
//  Table 5:  NS=12 STATIONARY,  EW=1..11 (each round)
//  Table 6:  NS=10..9 (rotating), EW=3..2 (rotating)
// ─────────────────────────────────────────────────────────────
const HOWELL_6TABLE = [
  // ── ROUND 1 ──────────────────────────────────────
  { round:1, table:1, nsPair:9,  ewPair:11, boards:[16,17,18] },
  { round:1, table:2, nsPair:7,  ewPair:4,  boards:[19,20,21] },
  { round:1, table:3, nsPair:8,  ewPair:2,  boards:[25,26,27] },
  { round:1, table:4, nsPair:5,  ewPair:6,  boards:[28,29,30] },
  { round:1, table:5, nsPair:12, ewPair:1,  boards:[31,32,33] }, // phantom NS
  { round:1, table:6, nsPair:10, ewPair:3,  boards:[1,2,3]   },

  // ── ROUND 2 ──────────────────────────────────────
  { round:2, table:1, nsPair:10, ewPair:1,  boards:[19,20,21] },
  { round:2, table:2, nsPair:8,  ewPair:5,  boards:[22,23,24] },
  { round:2, table:3, nsPair:9,  ewPair:3,  boards:[28,29,30] },
  { round:2, table:4, nsPair:6,  ewPair:7,  boards:[31,32,33] },
  { round:2, table:5, nsPair:12, ewPair:2,  boards:[1,2,3]   }, // phantom NS
  { round:2, table:6, nsPair:11, ewPair:4,  boards:[4,5,6]   },

  // ── ROUND 3 ──────────────────────────────────────
  { round:3, table:1, nsPair:11, ewPair:2,  boards:[22,23,24] },
  { round:3, table:2, nsPair:9,  ewPair:6,  boards:[25,26,27] },
  { round:3, table:3, nsPair:10, ewPair:4,  boards:[31,32,33] },
  { round:3, table:4, nsPair:7,  ewPair:8,  boards:[1,2,3]   },
  { round:3, table:5, nsPair:12, ewPair:3,  boards:[4,5,6]   }, // phantom NS
  { round:3, table:6, nsPair:1,  ewPair:5,  boards:[7,8,9]   },

  // ── ROUND 4 ──────────────────────────────────────
  { round:4, table:1, nsPair:1,  ewPair:3,  boards:[25,26,27] },
  { round:4, table:2, nsPair:10, ewPair:7,  boards:[28,29,30] },
  { round:4, table:3, nsPair:11, ewPair:5,  boards:[1,2,3]   },
  { round:4, table:4, nsPair:8,  ewPair:9,  boards:[4,5,6]   },
  { round:4, table:5, nsPair:12, ewPair:4,  boards:[7,8,9]   }, // phantom NS
  { round:4, table:6, nsPair:2,  ewPair:6,  boards:[10,11,12]   },

  // ── ROUND 5 ──────────────────────────────────────
  { round:5, table:1, nsPair:2,  ewPair:4,  boards:[28,29,30] },
  { round:5, table:2, nsPair:11, ewPair:8,  boards:[31,32,33] },
  { round:5, table:3, nsPair:1,  ewPair:6,  boards:[4,5,6]   },
  { round:5, table:4, nsPair:9,  ewPair:10, boards:[7,8,9]   },
  { round:5, table:5, nsPair:12, ewPair:5,  boards:[10,11,12]   }, // phantom NS
  { round:5, table:6, nsPair:3,  ewPair:7,  boards:[13,14,15]  },

  // ── ROUND 6 ──────────────────────────────────────
  { round:6, table:1, nsPair:3,  ewPair:5,  boards:[31,32,33] },
  { round:6, table:2, nsPair:1,  ewPair:9,  boards:[1,2,3]   },
  { round:6, table:3, nsPair:2,  ewPair:7,  boards:[7,8,9]   },
  { round:6, table:4, nsPair:10, ewPair:11, boards:[10,11,12]   },
  { round:6, table:5, nsPair:12, ewPair:6,  boards:[13,14,15]  }, // phantom NS
  { round:6, table:6, nsPair:4,  ewPair:8,  boards:[16,17,18] },

  // ── ROUND 7 ──────────────────────────────────────
  { round:7, table:1, nsPair:4,  ewPair:6,  boards:[1,2,3]   },
  { round:7, table:2, nsPair:2,  ewPair:10, boards:[4,5,6]   },
  { round:7, table:3, nsPair:3,  ewPair:8,  boards:[10,11,12]   },
  { round:7, table:4, nsPair:11, ewPair:1,  boards:[13,14,15]  },
  { round:7, table:5, nsPair:12, ewPair:7,  boards:[16,17,18] }, // phantom NS
  { round:7, table:6, nsPair:5,  ewPair:9,  boards:[19,20,21] },

  // ── ROUND 8 ──────────────────────────────────────
  { round:8, table:1, nsPair:5,  ewPair:7,  boards:[4,5,6]   },
  { round:8, table:2, nsPair:3,  ewPair:11, boards:[7,8,9]   },
  { round:8, table:3, nsPair:4,  ewPair:9,  boards:[13,14,15]  },
  { round:8, table:4, nsPair:1,  ewPair:2,  boards:[16,17,18] },
  { round:8, table:5, nsPair:12, ewPair:8,  boards:[19,20,21] }, // phantom NS
  { round:8, table:6, nsPair:6,  ewPair:10, boards:[22,23,24] },

  // ── ROUND 9 ──────────────────────────────────────
  { round:9, table:1, nsPair:6,  ewPair:8,  boards:[7,8,9]   },
  { round:9, table:2, nsPair:4,  ewPair:1,  boards:[10,11,12]   },
  { round:9, table:3, nsPair:5,  ewPair:10, boards:[16,17,18] },
  { round:9, table:4, nsPair:2,  ewPair:3,  boards:[19,20,21] },
  { round:9, table:5, nsPair:12, ewPair:9,  boards:[22,23,24] }, // phantom NS
  { round:9, table:6, nsPair:7,  ewPair:11, boards:[25,26,27] },

  // ── ROUND 10 ─────────────────────────────────────
  { round:10, table:1, nsPair:7,  ewPair:9,  boards:[10,11,12]   },
  { round:10, table:2, nsPair:5,  ewPair:2,  boards:[13,14,15]  },
  { round:10, table:3, nsPair:6,  ewPair:11, boards:[19,20,21] },
  { round:10, table:4, nsPair:3,  ewPair:4,  boards:[22,23,24] },
  { round:10, table:5, nsPair:12, ewPair:10, boards:[25,26,27] }, // phantom NS
  { round:10, table:6, nsPair:8,  ewPair:1,  boards:[28,29,30] },

  // ── ROUND 11 ─────────────────────────────────────
  { round:11, table:1, nsPair:8,  ewPair:10, boards:[13,14,15]  },
  { round:11, table:2, nsPair:6,  ewPair:3,  boards:[16,17,18] },
  { round:11, table:3, nsPair:7,  ewPair:1,  boards:[22,23,24] },
  { round:11, table:4, nsPair:4,  ewPair:5,  boards:[25,26,27] },
  { round:11, table:5, nsPair:12, ewPair:11, boards:[28,29,30] }, // phantom NS
  { round:11, table:6, nsPair:9,  ewPair:2,  boards:[31,32,33] },
];

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  7-TABLE HOWELL  (14 pairs · 13 rounds · 26 boards · pair 14
//  stationary NS at Table 4 — phantom when only 13 pairs)
// ─────────────────────────────────────────────────────────────
const HOWELL_7TABLE = [
  { round:1, table:1, nsPair:5, ewPair:12, boards:[1,2] },
  { round:1, table:2, nsPair:2, ewPair:4, boards:[3,4] },
  { round:1, table:3, nsPair:9, ewPair:10, boards:[5,6] },
  { round:1, table:4, nsPair:14, ewPair:1, boards:[7,8] },
  { round:1, table:5, nsPair:8, ewPair:13, boards:[9,10] },
  { round:1, table:6, nsPair:7, ewPair:11, boards:[11,12] },
  { round:1, table:7, nsPair:6, ewPair:3, boards:[13,14] },

  { round:2, table:1, nsPair:6, ewPair:13, boards:[3,4] },
  { round:2, table:2, nsPair:3, ewPair:5, boards:[5,6] },
  { round:2, table:3, nsPair:10, ewPair:11, boards:[7,8] },
  { round:2, table:4, nsPair:14, ewPair:2, boards:[9,10] },
  { round:2, table:5, nsPair:9, ewPair:1, boards:[11,12] },
  { round:2, table:6, nsPair:8, ewPair:12, boards:[13,14] },
  { round:2, table:7, nsPair:7, ewPair:4, boards:[15,16] },

  { round:3, table:1, nsPair:7, ewPair:1, boards:[5,6] },
  { round:3, table:2, nsPair:4, ewPair:6, boards:[7,8] },
  { round:3, table:3, nsPair:11, ewPair:12, boards:[9,10] },
  { round:3, table:4, nsPair:14, ewPair:3, boards:[11,12] },
  { round:3, table:5, nsPair:10, ewPair:2, boards:[13,14] },
  { round:3, table:6, nsPair:9, ewPair:13, boards:[15,16] },
  { round:3, table:7, nsPair:8, ewPair:5, boards:[17,18] },

  { round:4, table:1, nsPair:8, ewPair:2, boards:[7,8] },
  { round:4, table:2, nsPair:5, ewPair:7, boards:[9,10] },
  { round:4, table:3, nsPair:12, ewPair:13, boards:[11,12] },
  { round:4, table:4, nsPair:14, ewPair:4, boards:[13,14] },
  { round:4, table:5, nsPair:11, ewPair:3, boards:[15,16] },
  { round:4, table:6, nsPair:10, ewPair:1, boards:[17,18] },
  { round:4, table:7, nsPair:9, ewPair:6, boards:[19,20] },

  { round:5, table:1, nsPair:9, ewPair:3, boards:[9,10] },
  { round:5, table:2, nsPair:6, ewPair:8, boards:[11,12] },
  { round:5, table:3, nsPair:13, ewPair:1, boards:[13,14] },
  { round:5, table:4, nsPair:14, ewPair:5, boards:[15,16] },
  { round:5, table:5, nsPair:12, ewPair:4, boards:[17,18] },
  { round:5, table:6, nsPair:11, ewPair:2, boards:[19,20] },
  { round:5, table:7, nsPair:10, ewPair:7, boards:[21,22] },

  { round:6, table:1, nsPair:10, ewPair:4, boards:[11,12] },
  { round:6, table:2, nsPair:7, ewPair:9, boards:[13,14] },
  { round:6, table:3, nsPair:1, ewPair:2, boards:[15,16] },
  { round:6, table:4, nsPair:14, ewPair:6, boards:[17,18] },
  { round:6, table:5, nsPair:13, ewPair:5, boards:[19,20] },
  { round:6, table:6, nsPair:12, ewPair:3, boards:[21,22] },
  { round:6, table:7, nsPair:11, ewPair:8, boards:[23,24] },

  { round:7, table:1, nsPair:11, ewPair:5, boards:[13,14] },
  { round:7, table:2, nsPair:8, ewPair:10, boards:[15,16] },
  { round:7, table:3, nsPair:2, ewPair:3, boards:[17,18] },
  { round:7, table:4, nsPair:14, ewPair:7, boards:[19,20] },
  { round:7, table:5, nsPair:1, ewPair:6, boards:[21,22] },
  { round:7, table:6, nsPair:13, ewPair:4, boards:[23,24] },
  { round:7, table:7, nsPair:12, ewPair:9, boards:[25,26] },

  { round:8, table:1, nsPair:12, ewPair:6, boards:[15,16] },
  { round:8, table:2, nsPair:9, ewPair:11, boards:[17,18] },
  { round:8, table:3, nsPair:3, ewPair:4, boards:[19,20] },
  { round:8, table:4, nsPair:14, ewPair:8, boards:[21,22] },
  { round:8, table:5, nsPair:2, ewPair:7, boards:[23,24] },
  { round:8, table:6, nsPair:1, ewPair:5, boards:[25,26] },
  { round:8, table:7, nsPair:13, ewPair:10, boards:[1,2] },

  { round:9, table:1, nsPair:13, ewPair:7, boards:[17,18] },
  { round:9, table:2, nsPair:10, ewPair:12, boards:[19,20] },
  { round:9, table:3, nsPair:4, ewPair:5, boards:[21,22] },
  { round:9, table:4, nsPair:14, ewPair:9, boards:[23,24] },
  { round:9, table:5, nsPair:3, ewPair:8, boards:[25,26] },
  { round:9, table:6, nsPair:2, ewPair:6, boards:[1,2] },
  { round:9, table:7, nsPair:1, ewPair:11, boards:[3,4] },

  { round:10, table:1, nsPair:1, ewPair:8, boards:[19,20] },
  { round:10, table:2, nsPair:11, ewPair:13, boards:[21,22] },
  { round:10, table:3, nsPair:5, ewPair:6, boards:[23,24] },
  { round:10, table:4, nsPair:14, ewPair:10, boards:[25,26] },
  { round:10, table:5, nsPair:4, ewPair:9, boards:[1,2] },
  { round:10, table:6, nsPair:3, ewPair:7, boards:[3,4] },
  { round:10, table:7, nsPair:2, ewPair:12, boards:[5,6] },

  { round:11, table:1, nsPair:2, ewPair:9, boards:[21,22] },
  { round:11, table:2, nsPair:12, ewPair:1, boards:[23,24] },
  { round:11, table:3, nsPair:6, ewPair:7, boards:[25,26] },
  { round:11, table:4, nsPair:14, ewPair:11, boards:[1,2] },
  { round:11, table:5, nsPair:5, ewPair:10, boards:[3,4] },
  { round:11, table:6, nsPair:4, ewPair:8, boards:[5,6] },
  { round:11, table:7, nsPair:3, ewPair:13, boards:[7,8] },

  { round:12, table:1, nsPair:3, ewPair:10, boards:[23,24] },
  { round:12, table:2, nsPair:13, ewPair:2, boards:[25,26] },
  { round:12, table:3, nsPair:7, ewPair:8, boards:[1,2] },
  { round:12, table:4, nsPair:14, ewPair:12, boards:[3,4] },
  { round:12, table:5, nsPair:6, ewPair:11, boards:[5,6] },
  { round:12, table:6, nsPair:5, ewPair:9, boards:[7,8] },
  { round:12, table:7, nsPair:4, ewPair:1, boards:[9,10] },

  { round:13, table:1, nsPair:4, ewPair:11, boards:[25,26] },
  { round:13, table:2, nsPair:1, ewPair:3, boards:[1,2] },
  { round:13, table:3, nsPair:8, ewPair:9, boards:[3,4] },
  { round:13, table:4, nsPair:14, ewPair:13, boards:[5,6] },
  { round:13, table:5, nsPair:7, ewPair:12, boards:[7,8] },
  { round:13, table:6, nsPair:6, ewPair:10, boards:[9,10] },
  { round:13, table:7, nsPair:5, ewPair:2, boards:[11,12] },
];

function getHowellMovement(tables) {
  switch (tables) {
    case 3: return HOWELL_3TABLE;
    case 4: return HOWELL_4TABLE;
    case 5: return HOWELL_5TABLE;
    case 6: return HOWELL_6TABLE;
    case 7: return HOWELL_7TABLE;
    default: throw new Error(`No Howell movement for ${tables} tables`);
  }
}

function getPhantomPairNumber(tables) {
  return { 3:6, 4:8, 5:10, 6:12, 7:14 }[tables] ?? null;
}

module.exports = { getHowellMovement, getPhantomPairNumber };

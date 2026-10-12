'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { cell, toCsv } = require('../csv-util');

test('plain values pass through; null/undefined become empty', () => {
  assert.equal(cell('abc'), 'abc');
  assert.equal(cell(12), '12');
  assert.equal(cell(null), '');
  assert.equal(cell(undefined), '');
});

test('commas, quotes and newlines are quoted and escaped', () => {
  assert.equal(cell('Smith, John'), '"Smith, John"');
  assert.equal(cell('say "hi"'), '"say ""hi"""');
  assert.equal(cell('a\nb'), '"a\nb"');
});

test('formula-injection prefixes are neutralised', () => {
  assert.equal(cell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(cell('+1'), "'+1");
  assert.equal(cell('@cmd'), "'@cmd");
  assert.equal(cell('-5 Club'), "'-5 Club");
});

test('toCsv writes BOM, header and CRLF-separated rows', () => {
  const out = toCsv(['A', 'B'], [[1, 'x,y'], [2, 'z']]);
  assert.equal(out, '﻿A,B\r\n1,"x,y"\r\n2,z\r\n');
});

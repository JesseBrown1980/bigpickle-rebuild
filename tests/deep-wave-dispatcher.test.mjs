// Integration tests for deep-wave dispatcher.
// Per operator 2026-05-28T17:04Z "tests and review and unit tests and integration tests for all"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchWave, buildRoomList, expectedPacketsForWave } from '../src/deep-wave-dispatcher.mjs';
import { LANE_CYCLE } from '../src/pid-chain-revolver.mjs';
import { BEATS_PER_WAVE, TOTAL_BEATS, WAVE_COUNT } from '../src/deep-wave-decompose.mjs';

test('buildRoomList constructs N unique rooms with valid ids', () => {
  const rooms = buildRoomList({ count: 10 });
  assert.equal(rooms.length, 10);
  const ids = new Set(rooms.map(r => r.id));
  assert.equal(ids.size, 10);
  assert.match(rooms[0].id, /^acer-room-R00000-C00-F00$/);
});

test('expectedPacketsForWave policy=all is beatSpan x rooms x lanes', () => {
  const got = expectedPacketsForWave({ beatStart: 0, beatEnd: 100, roomCount: 10 });
  assert.equal(got, 100 * 10 * 7);
});

test('dispatchWave fires 1-room 1-beat smoke and returns 7 packets', () => {
  const rooms = buildRoomList({ count: 1 });
  const stats = dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: 1, rooms,
    cascadeId: 'smoke-1room-1beat',
  });
  assert.equal(stats.totalPackets, 7); // 1 room x 1 beat x 7 lanes
  assert.equal(stats.totalHookwallPass, 7);
  assert.equal(stats.totalHookwallReject, 0);
  for (const lane of LANE_CYCLE) {
    assert.equal(stats.laneCounts[lane], 1);
  }
});

test('dispatchWave fires 10-room 100-beat smoke = 7000 packets', () => {
  const rooms = buildRoomList({ count: 10 });
  const stats = dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: 100, rooms,
    cascadeId: 'smoke-10room-100beat',
  });
  assert.equal(stats.totalPackets, 10 * 100 * 7);
  assert.equal(stats.totalHookwallPass, 7000);
  for (const lane of LANE_CYCLE) {
    assert.equal(stats.laneCounts[lane], 1000); // 10 rooms x 100 beats x 1 lane each
  }
});

test('dispatchWave classifies into genius/mistake/neutral within expected ratios', () => {
  const rooms = buildRoomList({ count: 5 });
  const stats = dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: 500, rooms,
    cascadeId: 'smoke-classify',
  });
  // 5 rooms x 500 beats x 7 lanes = 17500 packets
  assert.equal(stats.totalPackets, 17500);
  // 95% threshold each: expect ~5% genius + ~5% mistake + ~90% neutral (uniform 0..1 from sha)
  const totalClassified = stats.totalGenius + stats.totalMistake + stats.totalNeutral;
  assert.equal(totalClassified, stats.totalHookwallPass);
  // Sanity bounds (large enough sample for statistical confidence)
  assert.ok(stats.totalGenius >= 500 && stats.totalGenius <= 2000, `genius ${stats.totalGenius} not in [500, 2000]`);
  assert.ok(stats.totalMistake >= 500 && stats.totalMistake <= 2000, `mistake ${stats.totalMistake} not in [500, 2000]`);
  assert.ok(stats.totalNeutral >= 13000, `neutral ${stats.totalNeutral} not >= 13000`);
});

test('dispatchWave with body-match-modulo-6 policy reduces packets by ~6x', () => {
  const rooms = buildRoomList({ count: 6 });
  const stats = dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: 60, rooms,
    cascadeId: 'smoke-body-match', roomPolicy: 'body-match-modulo-6',
  });
  // Each beat selects exactly 1 of 6 rooms via body dimension match
  // 60 beats x 1 room x 7 lanes = 420 packets
  assert.equal(stats.totalPackets, 420);
});

test('dispatchWave respects waveIdx safety filter', () => {
  const rooms = buildRoomList({ count: 1 });
  // beatStart in wave 0 range but we say waveIdx=1 → should skip all beats
  const stats = dispatchWave({
    waveIdx: 1, beatStart: 0, beatEnd: 100, rooms,
    cascadeId: 'smoke-wave-mismatch',
  });
  assert.equal(stats.totalPackets, 0);
});

test('dispatchWave wave 5 (last) fires correctly', () => {
  const rooms = buildRoomList({ count: 1 });
  const start = (WAVE_COUNT - 1) * BEATS_PER_WAVE; // 5 * 15552 = 77760
  const end = start + 10;
  const stats = dispatchWave({
    waveIdx: 5, beatStart: start, beatEnd: end, rooms,
    cascadeId: 'smoke-wave-5',
  });
  assert.equal(stats.totalPackets, 10 * 7);
  assert.equal(stats.waveIdx, 5);
});

test('dispatchWave rejects invalid waveIdx', () => {
  const rooms = buildRoomList({ count: 1 });
  assert.throws(() => dispatchWave({
    waveIdx: -1, beatStart: 0, beatEnd: 1, rooms, cascadeId: 'x',
  }), RangeError);
  assert.throws(() => dispatchWave({
    waveIdx: WAVE_COUNT, beatStart: 0, beatEnd: 1, rooms, cascadeId: 'x',
  }), RangeError);
});

test('dispatchWave rejects beatEnd > TOTAL_BEATS', () => {
  const rooms = buildRoomList({ count: 1 });
  assert.throws(() => dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: TOTAL_BEATS + 1, rooms, cascadeId: 'x',
  }), RangeError);
});

test('dispatchWave rejects empty rooms array', () => {
  assert.throws(() => dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: 1, rooms: [], cascadeId: 'x',
  }), TypeError);
});

test('integration: 5x5x5x5x5x12 smoke topology with LYMPHATIC 7-lane', () => {
  // Smoke variant: 5 protocols x 5 surfaces x 5 dims x 5 bodies x 12 shannon = 7500 beats
  // BUT we use real decomposition (6x6x...), so just fire first 1500 beats of wave 0 over 10 rooms
  const rooms = buildRoomList({ count: 10 });
  const beats = 1500;
  const stats = dispatchWave({
    waveIdx: 0, beatStart: 0, beatEnd: beats, rooms,
    cascadeId: 'smoke-5x5x5x5x12-equivalent',
  });
  const expected = beats * 10 * LANE_CYCLE.length;
  assert.equal(stats.totalPackets, expected);
  assert.equal(stats.totalHookwallPass, expected); // 100% pass per bigpickle canon
  // 7-lane LYMPHATIC presence
  assert.ok(LANE_CYCLE.includes('lymphatic'));
  assert.equal(stats.laneCounts.lymphatic, beats * 10);
});

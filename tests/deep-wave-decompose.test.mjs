// Unit tests for deep-wave-decompose.mjs
// Per operator "tests and review and unit tests and integration tests for all" 2026-05-28T17:04Z

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_BEATS, WAVE_COUNT, BEATS_PER_WAVE,
  WAVE_NAMES, PROTOCOL_NAMES, SURFACE_NAMES, DIMENSION_NAMES, BODY_NAMES, SHANNON_POSITIONS,
  decomposeBeat, composeBeat, beatLabel,
  roomId, parseRoomId, roomActiveForBeat,
} from '../src/deep-wave-decompose.mjs';

test('TOTAL_BEATS = 93312 = 6 x 15552', () => {
  assert.equal(TOTAL_BEATS, 93_312);
  assert.equal(WAVE_COUNT, 6);
  assert.equal(BEATS_PER_WAVE, 15_552);
  assert.equal(WAVE_COUNT * BEATS_PER_WAVE, TOTAL_BEATS);
});

test('cross-product: 6 x 6 x 6 x 6 x 6 x 12 = 93312', () => {
  const wave = WAVE_COUNT;
  const protocol = PROTOCOL_NAMES.length;
  const surface = SURFACE_NAMES.length;
  const dimension = DIMENSION_NAMES.length;
  const body = BODY_NAMES.length;
  const shannon = SHANNON_POSITIONS;
  assert.equal(wave * protocol * surface * dimension * body * shannon, TOTAL_BEATS);
  assert.equal(protocol * surface * dimension * body * shannon, BEATS_PER_WAVE);
});

test('decomposeBeat(0) = all zeros', () => {
  const d = decomposeBeat(0);
  assert.deepEqual(d, { wave: 0, protocol: 0, surface: 0, dimension: 0, body: 0, shannon: 0 });
});

test('decomposeBeat(TOTAL_BEATS - 1) = all max', () => {
  const d = decomposeBeat(TOTAL_BEATS - 1);
  assert.deepEqual(d, { wave: 5, protocol: 5, surface: 5, dimension: 5, body: 5, shannon: 11 });
});

test('decomposeBeat(BEATS_PER_WAVE) = wave 1 start', () => {
  const d = decomposeBeat(BEATS_PER_WAVE);
  assert.equal(d.wave, 1);
  assert.equal(d.protocol, 0);
  assert.equal(d.surface, 0);
  assert.equal(d.dimension, 0);
  assert.equal(d.body, 0);
  assert.equal(d.shannon, 0);
});

test('decomposeBeat rejects out-of-range', () => {
  assert.throws(() => decomposeBeat(-1), RangeError);
  assert.throws(() => decomposeBeat(TOTAL_BEATS), RangeError);
  assert.throws(() => decomposeBeat(1.5), RangeError);
});

test('composeBeat round-trips with decomposeBeat for sampled indices', () => {
  const sampleIndices = [0, 1, 11, 12, 71, 72, 431, 432, 2591, 2592, 15551, 15552, 31104, 50000, 80000, 93311];
  for (const i of sampleIndices) {
    const d = decomposeBeat(i);
    const i2 = composeBeat(d);
    assert.equal(i2, i, `round-trip i=${i} d=${JSON.stringify(d)} got=${i2}`);
  }
});

test('composeBeat rejects out-of-range fields', () => {
  assert.throws(() => composeBeat({ wave: 6, protocol: 0, surface: 0, dimension: 0, body: 0, shannon: 0 }), RangeError);
  assert.throws(() => composeBeat({ wave: 0, protocol: 0, surface: 0, dimension: 0, body: 0, shannon: 12 }), RangeError);
  assert.throws(() => composeBeat({ wave: -1, protocol: 0, surface: 0, dimension: 0, body: 0, shannon: 0 }), RangeError);
});

test('full enumeration: composeBeat(decomposeBeat(i)) === i for all 93312', () => {
  for (let i = 0; i < TOTAL_BEATS; i++) {
    if (composeBeat(decomposeBeat(i)) !== i) {
      throw new Error(`round-trip failed at i=${i}`);
    }
  }
});

test('per-wave beat ranges are contiguous and non-overlapping', () => {
  for (let w = 0; w < WAVE_COUNT; w++) {
    const start = w * BEATS_PER_WAVE;
    const end = (w + 1) * BEATS_PER_WAVE - 1;
    assert.equal(decomposeBeat(start).wave, w);
    assert.equal(decomposeBeat(end).wave, w);
    if (w > 0) {
      assert.equal(decomposeBeat(start).wave - decomposeBeat(start - 1).wave, 1);
    }
  }
});

test('beatLabel includes all 6 dimension names', () => {
  const label = beatLabel(0);
  assert.match(label, /wave=0/);
  assert.match(label, /protocol=bus/);
  assert.match(label, /surface=dashboard/);
  assert.match(label, /dim=G/);
  assert.match(label, /body=operator/);
  assert.match(label, /shannon=0/);
});

test('roomId formats correctly for boundary indices', () => {
  assert.equal(roomId({ idx: 0 }), 'acer-room-R00000-C00-F00');
  assert.equal(roomId({ idx: 99 }), 'acer-room-R00099-C99-F00');
  assert.equal(roomId({ idx: 100 }), 'acer-room-R00100-C00-F01');
  assert.equal(roomId({ idx: 9999 }), 'acer-room-R09999-C99-F99');
});

test('roomId honors custom vantage', () => {
  assert.equal(roomId({ idx: 5, vantage: 'liris' }), 'liris-room-R00005-C05-F00');
});

test('roomId rejects out-of-range idx', () => {
  assert.throws(() => roomId({ idx: -1 }), RangeError);
  assert.throws(() => roomId({ idx: 10_000 }), RangeError);
});

test('parseRoomId is inverse of roomId', () => {
  for (const idx of [0, 1, 99, 100, 5000, 9999]) {
    const id = roomId({ idx });
    const parsed = parseRoomId(id);
    assert.equal(parsed.idx, idx);
    assert.equal(parsed.vantage, 'acer');
    assert.equal(parsed.controller, idx % 100);
    assert.equal(parsed.flywheel, Math.floor(idx / 100));
  }
});

test('parseRoomId rejects malformed', () => {
  assert.throws(() => parseRoomId('not-a-room-id'), TypeError);
  assert.throws(() => parseRoomId('acer-room-R00-C00'), TypeError);
});

test('roomActiveForBeat policy=all returns true', () => {
  assert.equal(roomActiveForBeat({ roomIdx: 0, beatIdx: 0 }), true);
  assert.equal(roomActiveForBeat({ roomIdx: 9999, beatIdx: 93311 }), true);
});

test('roomActiveForBeat policy=body-match-modulo-6 filters correctly', () => {
  for (let i = 0; i < 100; i++) {
    const beatIdx = Math.floor(Math.random() * TOTAL_BEATS);
    const { body } = decomposeBeat(beatIdx);
    assert.equal(roomActiveForBeat({ roomIdx: body, beatIdx, policy: 'body-match-modulo-6' }), true);
    assert.equal(roomActiveForBeat({ roomIdx: (body + 1) % 6, beatIdx, policy: 'body-match-modulo-6' }), false);
  }
});

test('roomActiveForBeat rejects unknown policy', () => {
  assert.throws(() => roomActiveForBeat({ roomIdx: 0, beatIdx: 0, policy: 'unknown' }), RangeError);
});

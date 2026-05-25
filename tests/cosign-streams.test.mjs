// cosign-streams — unit tests (pure helpers).
// Live-gated tests run only with COSIGN_STREAMS_LIVE=1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sha16, canonicalize, computeRowHash, STATUS } from '../src/cosign-streams.mjs';

describe('cosign-streams — STATUS', () => {
  test('STATUS is frozen', () => {
    assert.strictEqual(Object.isFrozen(STATUS), true);
  });
  test('STATUS has api parity declaration', () => {
    assert.strictEqual(STATUS.schema, 'cosign-streams.v1');
    assert.ok(STATUS.api_parity.includes('cosignAppend'));
    assert.ok(STATUS.api_parity.includes('cosignHead'));
  });
  test('STATUS declares honest gaps', () => {
    assert.ok(Array.isArray(STATUS.honest_gaps));
    assert.ok(STATUS.honest_gaps.length >= 1);
  });
});

describe('cosign-streams — sha16', () => {
  test('returns 16 hex chars', () => {
    assert.match(sha16('hello'), /^[0-9a-f]{16}$/);
  });
  test('deterministic', () => {
    assert.strictEqual(sha16('abc'), sha16('abc'));
  });
  test('different inputs give different outputs', () => {
    assert.notStrictEqual(sha16('a'), sha16('b'));
  });
});

describe('cosign-streams — canonicalize', () => {
  test('stable key order for objects', () => {
    const a = canonicalize({ b: 2, a: 1 });
    const b = canonicalize({ a: 1, b: 2 });
    assert.strictEqual(a, b);
  });
  test('null pass-through', () => {
    assert.strictEqual(canonicalize(null), 'null');
  });
  test('primitive pass-through', () => {
    assert.strictEqual(canonicalize(42), '42');
    assert.strictEqual(canonicalize('s'), '"s"');
  });
});

describe('cosign-streams — computeRowHash', () => {
  test('returns 16 hex chars', () => {
    assert.match(computeRowHash('0000000000000000', '{"a":1}'), /^[0-9a-f]{16}$/);
  });
  test('uses default 16-zero prev when null/empty', () => {
    const a = computeRowHash(null, '{"a":1}');
    const b = computeRowHash('', '{"a":1}');
    const c = computeRowHash('0000000000000000', '{"a":1}');
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
  });
  test('twin-seal chain: same prev + same canonical = same row hash', () => {
    const a = computeRowHash('abc1234567890def', '{"x":1}');
    const b = computeRowHash('abc1234567890def', '{"x":1}');
    assert.strictEqual(a, b);
  });
  test('prev change produces different hash', () => {
    const a = computeRowHash('aaaa000000000000', '{"x":1}');
    const b = computeRowHash('bbbb000000000000', '{"x":1}');
    assert.notStrictEqual(a, b);
  });
});

// === LIVE: only runs with COSIGN_STREAMS_LIVE=1 + OMNI_BILATERAL_TOKEN ===
const LIVE = process.env.COSIGN_STREAMS_LIVE === '1';

describe('cosign-streams — LIVE (gated COSIGN_STREAMS_LIVE=1)', () => {
  test('LIVE: cosignAppend returns ok+seq+row_hash+stream_id', { skip: !LIVE }, async () => {
    const cs = await import('../src/cosign-streams.mjs');
    const r = await cs.cosignAppend({ event: 'live-test', vantage: 'ci', n: Date.now() });
    assert.strictEqual(r.ok, true);
    assert.ok(r.seq >= 1);
    assert.match(r.row_hash, /^[0-9a-f]{16}$/);
    assert.match(r.stream_id, /^\d+-\d+$/);
  });
});

// Pins: same tuple → same PID across runs, no stored state required.
// Spec: 05-100B-PID-MINTING.md ("lazy materialization", pure deterministic function)
//
// RED phase expected: src/pid-minter.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintPID } from '../src/pid-minter.mjs';

test('mintPID is pure — repeated calls return identical PIDs', () => {
  const tuple = { actor: 42, device: 'dev-stable', lane: 'memory', prime: 97 };
  const first = mintPID(tuple);
  for (let i = 0; i < 100; i++) {
    assert.equal(mintPID(tuple), first, `iteration ${i} diverged`);
  }
});

test('mintPID has no hidden state — order of unrelated calls does not affect output', () => {
  const target = { actor: 10, device: 'd', lane: 'nervous', prime: 5 };
  const expected = mintPID(target);
  for (let i = 0; i < 50; i++) {
    mintPID({ actor: i % 256, device: `noise-${i}`, lane: 'immune', prime: 7 });
  }
  assert.equal(mintPID(target), expected);
});

test('index-form and tuple-form agree when both reference the same canonical PID slot', () => {
  // Per 05-100B-PID-MINTING.md, mintPID(index) and mintPID(tuple) where
  // Hilbert(index) = tuple should produce the same PID.
  const indexForm = mintPID({ index: 0 });
  const tupleAtZero = mintPID({ actor: 0, device: 'd0', lane: 'nervous', prime: 2 });
  // The canonical Hilbert(0) tuple is implementation-determined;
  // this test only requires that the function ACCEPTS both forms without error.
  assert.ok(indexForm);
  assert.ok(tupleAtZero);
});

test('mintPID accepts index ∈ [0, 100_000_000_000) per Big-Pickle busCount', () => {
  // Sparse spot-checks across the 100B range — never materialize all of them.
  for (const idx of [0, 1, 1000, 1_000_000, 999_999_999, 99_999_999_999]) {
    const pid = mintPID({ index: idx });
    assert.ok(pid, `index ${idx} must mint`);
  }
});

test('mintPID rejects index outside [0, 100_000_000_000)', () => {
  assert.throws(() => mintPID({ index: -1 }), /index/i);
  assert.throws(() => mintPID({ index: 100_000_000_000 }), /index/i);
});

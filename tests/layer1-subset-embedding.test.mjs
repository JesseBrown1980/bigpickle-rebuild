// Pins: BEHCS-256 indices are valid as the first 256 of BEHCS-1024 (subset embedding).
// Spec: 02-PORT-NAMESPACE-CANON.md v2 amendment + 03-CUBE-OF-CUBES.md v2 amendment.
//
// RED phase expected: src/behcs.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEHCS256, BEHCS1024 } from '../src/behcs.mjs';
import { mintPID } from '../src/pid-minter.mjs';

test('BEHCS256 has exactly 256 distinct glyphs', () => {
  assert.equal(BEHCS256.size, 256);
  const set = new Set(BEHCS256.glyphs);
  assert.equal(set.size, 256);
});

test('BEHCS1024 has exactly 1024 distinct glyphs', () => {
  assert.equal(BEHCS1024.size, 1024);
  const set = new Set(BEHCS1024.glyphs);
  assert.equal(set.size, 1024);
});

test('BEHCS1024 glyphs 0..255 are IDENTICAL to BEHCS256 (subset embedding)', () => {
  for (let i = 0; i < 256; i++) {
    assert.equal(
      BEHCS1024.glyphs[i],
      BEHCS256.glyphs[i],
      `subset embedding broken at index ${i}`
    );
  }
});

test('a v1 BEHCS-256 PID is a valid v2 BEHCS-1024 PID', () => {
  const v1Pid = mintPID({ actor: 100, device: 'd', lane: 'memory', prime: 11, alphabet: 256 });
  const v2Pid = mintPID({ actor: 100, device: 'd', lane: 'memory', prime: 11, alphabet: 1024 });
  // Per 03-CUBE-OF-CUBES.md v2: v1 mintPID(index, BEHCS-256 actor) ≡ v2 mintPID(index, BEHCS-1024 actor[0..255]).
  assert.equal(v1Pid, v2Pid);
});

test('BEHCS-1024 actor index >= 256 is rejected by BEHCS-256 minter', () => {
  assert.throws(
    () => mintPID({ actor: 256, device: 'd', lane: 'nervous', prime: 2, alphabet: 256 }),
    /actor/i
  );
});

test('BEHCS-1024 minter accepts the full 0..1023 range', () => {
  for (const a of [0, 255, 256, 1000, 1023]) {
    const pid = mintPID({ actor: a, device: 'd', lane: 'nervous', prime: 2, alphabet: 1024 });
    assert.ok(pid, `actor ${a} must mint under BEHCS-1024`);
  }
  assert.throws(
    () => mintPID({ actor: 1024, device: 'd', lane: 'nervous', prime: 2, alphabet: 1024 }),
    /actor/i
  );
});

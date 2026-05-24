// Pins: Hilbert curve property — neighbors in 1D index are neighbors in k-D coordinate.
// Spec: 03-CUBE-OF-CUBES.md ("Locality-preserving … neighbors in 1D are neighbors in k-D")
//
// RED phase expected: src/hilbert.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hilbertEncode, hilbertDecode } from '../src/hilbert.mjs';

function manhattan(a, b) {
  return a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
}

test('hilbertEncode and hilbertDecode are mutual inverses on the 2D unit grid', () => {
  const N = 16;          // 2D, 4-bit per axis → 256 points
  for (let i = 0; i < N * N; i++) {
    const coord = hilbertDecode(i, { dimensions: 2, bits: 4 });
    const back = hilbertEncode(coord, { dimensions: 2, bits: 4 });
    assert.equal(back, i, `roundtrip failed at index ${i}`);
  }
});

test('consecutive 1D indices map to k-D coords within distance 1 (Hilbert distortion bound)', () => {
  const N = 16;
  let prev = hilbertDecode(0, { dimensions: 2, bits: 4 });
  for (let i = 1; i < N * N; i++) {
    const curr = hilbertDecode(i, { dimensions: 2, bits: 4 });
    assert.equal(
      manhattan(prev, curr),
      1,
      `Hilbert curve jumped >1 step between index ${i - 1} and ${i}`
    );
    prev = curr;
  }
});

test('hilbert encoding is bijective on the 3D grid as well', () => {
  const bits = 3; // 3D, 3-bit per axis → 512 points
  const total = 1 << (3 * bits);
  const seen = new Set();
  for (let i = 0; i < total; i++) {
    const coord = hilbertDecode(i, { dimensions: 3, bits });
    const key = coord.join(',');
    assert.ok(!seen.has(key), `duplicate coord ${key} at index ${i}`);
    seen.add(key);
  }
  assert.equal(seen.size, total);
});

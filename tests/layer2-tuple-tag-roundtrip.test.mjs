// Pins: 47D tuple-tag encoding round-trips losslessly.
// Spec: C:/asolaria-foundation-v1/03-CUBE-OF-CUBES.md (47D Brown-Hilbert hyperlanguage)
//       + brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md
//
// RED phase expected: src/tuple-tag.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTupleTag, decodeTupleTag, TUPLE_DIMS } from '../src/tuple-tag.mjs';

test('TUPLE_DIMS is the canonical 47', () => {
  assert.equal(TUPLE_DIMS, 47);
});

test('encode + decode is identity for a complete 47-tuple', () => {
  const tuple = Array.from({ length: 47 }, (_, i) => `D${i + 1}-value`);
  const bytes = encodeTupleTag(tuple);
  const back = decodeTupleTag(bytes);
  assert.deepEqual(back, tuple);
});

test('round-trip handles unicode, empty strings, and long values', () => {
  const tuple = Array.from({ length: 47 }, (_, i) => '');
  tuple[0] = 'acer-sidecar';
  tuple[1] = '∫♤⁂④φ[⑯⑥';            // unicode glyph block
  tuple[14] = 'a'.repeat(2000);     // long value (within uint16 cap)
  tuple[46] = 'boundary_typed';
  const back = decodeTupleTag(encodeTupleTag(tuple));
  assert.deepEqual(back, tuple);
});

test('encode is deterministic — same tuple yields same bytes', () => {
  const tuple = Array.from({ length: 47 }, (_, i) => `D${i + 1}`);
  const a = encodeTupleTag(tuple);
  const b = encodeTupleTag(tuple);
  assert.deepEqual([...a], [...b]);
});

test('short tuple is padded to 47 on encode', () => {
  const tuple = ['only', 'three', 'entries'];
  const back = decodeTupleTag(encodeTupleTag(tuple));
  assert.equal(back.length, 47);
  assert.equal(back[0], 'only');
  assert.equal(back[1], 'three');
  assert.equal(back[2], 'entries');
  for (let i = 3; i < 47; i++) assert.equal(back[i], '');
});

test('non-array input is rejected', () => {
  assert.throws(() => encodeTupleTag(null), /array/i);
  assert.throws(() => encodeTupleTag('not-array'), /array/i);
  assert.throws(() => encodeTupleTag(42), /array/i);
});

// Pins: JSON sidecars are written only when the cold flag is explicit.
// Spec: brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md
//       feedback_hbp_first_json_cold_only_2026_05_22.md
//
// "JSON is cold compatibility, report, dashboard, debug, or archival output only."
//
// RED phase expected: src/hbp-emitter.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeHBP } from '../src/hbp-emitter.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'hbp-jsoncold-'));
}

function env() {
  return { type: 'msg', payload: 'p', tupleTag: ['a', 'b', 'c'] };
}

test('writeHBP default does NOT write a JSON sidecar', () => {
  const dir = tmp();
  try {
    const paths = writeHBP(join(dir, 'no-json'), env());
    assert.equal(paths.json, undefined, 'paths.json must be undefined by default');
    assert.ok(!existsSync(join(dir, 'no-json.cold.json')));
    assert.ok(!existsSync(join(dir, 'no-json.json')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeHBP with { cold: true } writes a .cold.json sidecar', () => {
  const dir = tmp();
  try {
    const paths = writeHBP(join(dir, 'with-json'), env(), { cold: true });
    assert.ok(paths.json, 'paths.json must point to the cold JSON');
    assert.ok(existsSync(paths.json));
    assert.match(paths.json, /\.cold\.json$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cold JSON content is a valid envelope serialization', () => {
  const dir = tmp();
  try {
    const original = env();
    const paths = writeHBP(join(dir, 'roundtrip'), original, { cold: true });
    const parsed = JSON.parse(readFileSync(paths.json, 'utf8'));
    assert.equal(parsed.type, original.type);
    assert.equal(parsed.payload, original.payload);
    assert.deepEqual(parsed.tupleTag, original.tupleTag);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cold flag does not affect the SHA of the HBP body', () => {
  const dir = tmp();
  try {
    const hot = writeHBP(join(dir, 'hot'), env());
    const cold = writeHBP(join(dir, 'cold'), env(), { cold: true });
    assert.equal(hot.sha, cold.sha, 'cold JSON must not perturb HBP digest');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

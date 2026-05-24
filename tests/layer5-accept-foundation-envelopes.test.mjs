// Pins: Foundation v1 envelopes pass through the rebuild pipeline cleanly.
//
// Spec: TESTS-PLAN.md Layer 5.
//   - Each .behcs-256.json envelope adapts to internal shape.
//   - Hookwall accepts every adapted envelope.
//   - writeHBP produces stable sidecars on re-emission.
//
// CI uses bundled fixtures at tests/fixtures/. Locally, if the real Foundation
// envelope directory exists, the test ALSO walks it (deeper coverage). The
// real-path step is skipped (not failed) when the directory is absent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  adaptToInternal,
  loadFoundationEnvelope,
  loadFoundationEnvelopes,
} from '../src/foundation-envelope-adapter.mjs';
import { Hookwall } from '../src/hookwall.mjs';
import { writeHBP } from '../src/hbp-emitter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures');
const REAL_DIR = 'C:/asolaria-foundation-v1/envelopes';

function tmpOut() {
  return mkdtempSync(join(tmpdir(), 'l5-out-'));
}

test('adaptToInternal produces hookwall-ready envelope (type + tupleTag)', () => {
  const raw = {
    envelope_type: 'TEST_TYPE',
    verb: 'do.something',
    from: 'a',
    to: 'b',
    ts: '2026-05-24T00:00:00Z',
    envelope_id: 'X-1',
  };
  const adapted = adaptToInternal(raw);
  assert.equal(adapted.type, 'TEST_TYPE');
  assert.ok(Array.isArray(adapted.tupleTag));
  assert.equal(adapted.tupleTag.length, 47);
  assert.equal(adapted.tupleTag[0], 'a');     // D1 ACTOR
  assert.equal(adapted.tupleTag[1], 'do.something'); // D2 VERB
  assert.equal(adapted.tupleTag[2], 'b');     // D3 TARGET
  assert.equal(adapted.payload, raw);
  assert.equal(adapted.metadata.envelope_id, 'X-1');
});

test('adaptToInternal rejects non-object raw', () => {
  assert.throws(() => adaptToInternal(null), /object/i);
  assert.throws(() => adaptToInternal([]), /object/i);
  assert.throws(() => adaptToInternal('str'), /object/i);
});

test('every bundled fixture loads, adapts, and passes hookwall', () => {
  const entries = loadFoundationEnvelopes(FIXTURE_DIR);
  assert.ok(entries.length >= 2, `expected fixtures; got ${entries.length}`);
  const hw = new Hookwall({ name: 'hookwall-l5' });
  for (const { file, envelope } of entries) {
    const passed = hw.pass(envelope);
    assert.equal(passed.gate, 'hookwall-l5', `gate missing on ${file}`);
  }
  assert.equal(hw.passedCount, entries.length);
  assert.equal(hw.rejectedCount, 0);
});

test('writeHBP re-emits adapted fixture with sidecars and stable SHA', () => {
  const entries = loadFoundationEnvelopes(FIXTURE_DIR);
  const sample = entries[0].envelope;
  const dir = tmpOut();
  try {
    const a = writeHBP(join(dir, 're-emit-a'), sample);
    const b = writeHBP(join(dir, 're-emit-b'), sample);
    assert.equal(a.sha, b.sha, 'SHA not stable on re-emission');
    for (const k of ['hbp', 'hbi', 'sha256', 'hex']) {
      assert.ok(existsSync(a[k]), `${k} sidecar missing`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadFoundationEnvelope errors clearly on missing file', () => {
  assert.throws(() => loadFoundationEnvelope(join(FIXTURE_DIR, 'no-such-file.json')), /not found/);
});

test('real Foundation envelopes (if present locally) all accept', { skip: !existsSync(REAL_DIR) }, () => {
  const entries = loadFoundationEnvelopes(REAL_DIR);
  // Some local installs may have zero matching files; only assert behavior if some exist.
  if (entries.length === 0) return;
  const hw = new Hookwall({ name: 'hookwall-l5-real' });
  for (const { file, envelope } of entries) {
    try {
      hw.pass(envelope);
    } catch (err) {
      assert.fail(`real envelope rejected: ${file}: ${err.message}`);
    }
  }
});

// Pins: every .hbp write produces .hbi + .sha256 + .hex sidecars.
// Spec: C:/Users/acer/Asolaria/brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md
//
// RED phase expected: src/hbp-emitter.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeHBP } from '../src/hbp-emitter.mjs';

function makeEnvelope() {
  return {
    type: 'test-message',
    tupleTag: Array.from({ length: 47 }, (_, i) => `D${i + 1}`),
    payload: 'hello world',
    metadata: { author: 'acer-test', source: 'layer2-suite' },
  };
}

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hbp-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('writeHBP emits .hbp + .hbi + .sha256 + .hex sidecars', () => {
  withTmpDir((dir) => {
    const paths = writeHBP(join(dir, 'sample'), makeEnvelope());
    assert.ok(existsSync(paths.hbp), '.hbp not written');
    assert.ok(existsSync(paths.hbi), '.hbi not written');
    assert.ok(existsSync(paths.sha256), '.sha256 not written');
    assert.ok(existsSync(paths.hex), '.hex not written');
  });
});

test('.sha256 sidecar contains the same hash as returned from writeHBP', () => {
  withTmpDir((dir) => {
    const paths = writeHBP(join(dir, 'sample'), makeEnvelope());
    const onDisk = readFileSync(paths.sha256, 'utf8').split(/\s+/)[0];
    assert.equal(onDisk, paths.sha);
  });
});

test('.hex sidecar is a valid hex dump of the .hbp body', () => {
  withTmpDir((dir) => {
    const paths = writeHBP(join(dir, 'sample'), makeEnvelope());
    const body = readFileSync(paths.hbp);
    const hexDump = readFileSync(paths.hex, 'utf8').replace(/\s+/g, '');
    assert.equal(hexDump, body.toString('hex'));
  });
});

test('.hbi sidecar references the .hbp filename and the sha', () => {
  withTmpDir((dir) => {
    const paths = writeHBP(join(dir, 'sample'), makeEnvelope());
    const hbi = readFileSync(paths.hbi, 'utf8');
    assert.match(hbi, /sample\.hbp/);
    assert.match(hbi, new RegExp(`sha256=${paths.sha}`));
  });
});

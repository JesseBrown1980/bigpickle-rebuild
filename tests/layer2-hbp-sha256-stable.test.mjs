// Pins: identical envelope produces identical SHA256.
// Spec: hot-path canon — SHA-stable digest is the hot-path identity.
//
// RED phase expected: src/hbp-emitter.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeHBP } from '../src/hbp-emitter.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'hbp-stable-'));
}

test('identical envelope written twice yields identical SHA256', () => {
  const dir = tmp();
  try {
    const env = {
      type: 'msg',
      tupleTag: Array.from({ length: 47 }, (_, i) => `D${i + 1}`),
      payload: 'stable payload',
      metadata: { a: '1', b: '2' },
    };
    const a = writeHBP(join(dir, 'a'), env);
    const b = writeHBP(join(dir, 'b'), env);
    assert.equal(a.sha, b.sha);
    assert.equal(readFileSync(a.hbp, 'utf8'), readFileSync(b.hbp, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('metadata key order does not affect SHA256 (canonical sort)', () => {
  const dir = tmp();
  try {
    const env1 = { type: 'm', payload: 'p', metadata: { a: '1', b: '2', c: '3' } };
    const env2 = { type: 'm', payload: 'p', metadata: { c: '3', a: '1', b: '2' } };
    const a = writeHBP(join(dir, 'a'), env1);
    const b = writeHBP(join(dir, 'b'), env2);
    assert.equal(a.sha, b.sha, 'metadata key order must not affect digest');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('different payload yields different SHA256', () => {
  const dir = tmp();
  try {
    const a = writeHBP(join(dir, 'a'), { type: 'm', payload: 'one' });
    const b = writeHBP(join(dir, 'b'), { type: 'm', payload: 'two' });
    assert.notEqual(a.sha, b.sha);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('different tuple-tag yields different SHA256', () => {
  const dir = tmp();
  try {
    const t1 = Array.from({ length: 47 }, (_, i) => `v${i}`);
    const t2 = [...t1]; t2[0] = 'CHANGED';
    const a = writeHBP(join(dir, 'a'), { type: 'm', payload: 'p', tupleTag: t1 });
    const b = writeHBP(join(dir, 'b'), { type: 'm', payload: 'p', tupleTag: t2 });
    assert.notEqual(a.sha, b.sha);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

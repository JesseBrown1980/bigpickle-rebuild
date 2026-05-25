// Unit tests for cosign bridge — Node-native HTTP client for :4953 daemon.
// Pure helpers tested always; live daemon tests gated on COSIGN_TEST=1.
// NOTE: cosign daemon is ACER-VANTAGE-LOCAL (bound to 127.0.0.1 only).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasNonAscii,
  findNonAscii,
  cosignAppend,
  cosignHead,
  durableNotify,
  STATUS,
} from '../src/cosign-bridge.mjs';

// === hasNonAscii / findNonAscii ===========================================

test('hasNonAscii returns false for pure ASCII', () => {
  assert.equal(hasNonAscii('plain ascii 123 !@#'), false);
  assert.equal(hasNonAscii(''), false);
});

test('hasNonAscii detects em-dash (the canon bug glyph)', () => {
  assert.equal(hasNonAscii('em\u2014dash'), true);
});

test('hasNonAscii detects curly quotes', () => {
  assert.equal(hasNonAscii('he said \u201chi\u201d'), true);
});

test('hasNonAscii handles non-string inputs via String coercion', () => {
  assert.equal(hasNonAscii(123), false);
  assert.equal(hasNonAscii(null), false);
});

test('findNonAscii returns [] for pure ASCII', () => {
  assert.deepEqual(findNonAscii('clean ascii'), []);
});

test('findNonAscii reports position, code, hex, and char of each offender', () => {
  const offenders = findNonAscii('a\u2014b\u2014c');
  assert.equal(offenders.length, 2);
  assert.equal(offenders[0].pos, 1);
  assert.equal(offenders[0].code, 0x2014);
  assert.equal(offenders[0].hex, '0x2014');
  assert.equal(offenders[0].char, '\u2014');
  assert.equal(offenders[1].pos, 3);
});

// === durableNotify input validation (no I/O before throws) ================

test('durableNotify throws TypeError on empty channel', async () => {
  await assert.rejects(
    () => durableNotify('', { event: 'tick' }, { publish: async () => ({ ok: true }) }),
    TypeError,
  );
});

test('durableNotify throws TypeError on missing redisBridge.publish', async () => {
  await assert.rejects(
    () => durableNotify('omni-asolaria/acer/x/y', { event: 'tick' }, null),
    TypeError,
  );
  await assert.rejects(
    () => durableNotify('omni-asolaria/acer/x/y', { event: 'tick' }, {}),
    TypeError,
  );
});

// === STATUS canon =========================================================

test('STATUS is frozen and documents schema + routes', () => {
  assert.ok(Object.isFrozen(STATUS));
  assert.equal(STATUS.schema, 'cosign-bridge.v1');
  assert.equal(STATUS.default_endpoint, 'http://127.0.0.1:4953');
  assert.ok(Array.isArray(STATUS.routes));
  assert.ok(STATUS.routes.includes('POST /api/cosign/append'));
  assert.match(STATUS.bypasses_bug, /em-dash|utf/i);
});

// === Live daemon (env-gated, acer-local only) =============================

const LIVE = process.env.COSIGN_TEST === '1';
const LIVE_HOST = process.env.COSIGN_HOST || '127.0.0.1';
const LIVE_PORT = parseInt(process.env.COSIGN_PORT || '4953', 10);

test('LIVE: cosignHead returns chain head (skipped unless COSIGN_TEST=1)', { skip: !LIVE }, async () => {
  const head = await cosignHead({ host: LIVE_HOST, port: LIVE_PORT });
  assert.equal(typeof head, 'object');
  assert.ok(head !== null);
});

test('LIVE: cosignAppend round-trips ASCII payload (skipped unless COSIGN_TEST=1)', { skip: !LIVE }, async () => {
  const payload = {
    event: 'unit-test-tick',
    vantage: 'acer',
    ts: new Date().toISOString(),
    note: 'cosign-bridge.test.mjs smoke',
  };
  const r = await cosignAppend(payload, { host: LIVE_HOST, port: LIVE_PORT });
  assert.equal(typeof r, 'object');
  assert.equal(r.ok, true);
});

test('LIVE: cosignAppend tolerates em-dash via Node http (skipped unless COSIGN_TEST=1)', { skip: !LIVE }, async () => {
  // This is the bug Node http bypasses — em-dash through curl mangles.
  const payload = { event: 'em\u2014dash-test', vantage: 'acer', note: 'a\u2014b' };
  const r = await cosignAppend(payload, { host: LIVE_HOST, port: LIVE_PORT });
  assert.equal(r.ok, true);
});

// Unit tests for Redis bridge — synaptic substrate.
// Pure helpers tested always; live broker tests gated on OMNI_REDIS_TEST=1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedisBridge, channelFor, parseChannel, STATUS } from '../src/redis-bridge.mjs';

// === channelFor / parseChannel (pure) =====================================

test('channelFor composes omni-asolaria/<vantage>/<verb>/<sector>', () => {
  assert.equal(channelFor('acer', 'cosign', 'append'), 'omni-asolaria/acer/cosign/append');
  assert.equal(channelFor('liris', 'voxel', 'mint'), 'omni-asolaria/liris/voxel/mint');
});

test('channelFor throws when any segment is missing', () => {
  assert.throws(() => channelFor('', 'verb', 'sector'), RangeError);
  assert.throws(() => channelFor('acer', '', 'sector'), RangeError);
  assert.throws(() => channelFor('acer', 'verb', ''), RangeError);
  assert.throws(() => channelFor(), RangeError);
});

test('parseChannel decomposes a valid channel', () => {
  const r = parseChannel('omni-asolaria/acer/cosign/append');
  assert.equal(r.namespace, 'omni-asolaria');
  assert.equal(r.vantage, 'acer');
  assert.equal(r.verb, 'cosign');
  assert.equal(r.sector, 'append');
});

test('parseChannel preserves multi-segment sectors', () => {
  const r = parseChannel('omni-asolaria/liris/voxel/mint/forge/sub');
  assert.equal(r.sector, 'mint/forge/sub');
});

test('parseChannel returns null on invalid namespace', () => {
  assert.equal(parseChannel('not-asolaria/x/y/z'), null);
  assert.equal(parseChannel('omni-asolaria/only/two'), null);
  assert.equal(parseChannel(''), null);
});

// === RedisBridge construction (no I/O) ====================================

test('RedisBridge constructor takes defaults', () => {
  const b = new RedisBridge();
  assert.equal(b.host, '127.0.0.1');
  assert.equal(b.port, 6379);
  assert.equal(b.bearer, null);
  assert.equal(b.vantage, 'acer');
  assert.equal(b.connected, false);
});

test('RedisBridge constructor accepts opts', () => {
  const b = new RedisBridge({
    host: '192.168.1.50',
    port: 6380,
    bearer: 'token-abc',
    vantage: 'liris',
  });
  assert.equal(b.host, '192.168.1.50');
  assert.equal(b.port, 6380);
  assert.equal(b.bearer, 'token-abc');
  assert.equal(b.vantage, 'liris');
});

test('RedisBridge.publish rejects empty channel before any I/O', async () => {
  const b = new RedisBridge();
  await assert.rejects(() => b.publish('', 'payload'), TypeError);
  await assert.rejects(() => b.publish(null, 'payload'), TypeError);
});

test('RedisBridge.close is safe when never connected', () => {
  const b = new RedisBridge();
  b.close();
  assert.equal(b.connected, false);
});

// === STATUS canon =========================================================

test('STATUS is frozen and documents bypass surface', () => {
  assert.ok(Object.isFrozen(STATUS));
  assert.equal(STATUS.default_port, 6379);
  assert.equal(STATUS.schema, 'redis-bridge-skeleton.v1');
  assert.ok(STATUS.bypasses.includes('Windows SMB stack'));
});

// === Live broker (env-gated) ==============================================

const LIVE = process.env.OMNI_REDIS_TEST === '1';
const LIVE_HOST = process.env.OMNI_REDIS_HOST || '127.0.0.1';
const LIVE_PORT = parseInt(process.env.OMNI_REDIS_PORT || '6379', 10);
const LIVE_TOKEN = process.env.OMNI_BILATERAL_TOKEN || null;

test('LIVE: connect + ping + close (skipped unless OMNI_REDIS_TEST=1)', { skip: !LIVE }, async () => {
  const b = new RedisBridge({ host: LIVE_HOST, port: LIVE_PORT, bearer: LIVE_TOKEN });
  await b.connect();
  if (LIVE_TOKEN) {
    const a = await b.auth();
    assert.equal(a.ok, true);
  }
  const p = await b.ping();
  assert.equal(p.ok, true);
  assert.equal(p.value, 'PONG');
  b.close();
});

test('LIVE: publish returns subscriber count (skipped unless OMNI_REDIS_TEST=1)', { skip: !LIVE }, async () => {
  const b = new RedisBridge({ host: LIVE_HOST, port: LIVE_PORT, bearer: LIVE_TOKEN });
  await b.connect();
  if (LIVE_TOKEN) await b.auth();
  const r = await b.publish('omni-asolaria/test/unit/smoke', { ts: Date.now() });
  assert.equal(r.ok, true);
  assert.equal(typeof r.subscribers, 'number');
  b.close();
});

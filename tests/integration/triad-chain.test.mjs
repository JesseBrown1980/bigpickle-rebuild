// Integration test — Triad chain wired end-to-end.
//
// Verifies the bilateral synaptic substrate stack composes correctly:
//   zeta-process  → mtp-heads  → revolver.preWarm()  → durableNotify
//                ↘ hrm-slow-fast (shape pull)
//                                ↘ cosign-bridge (mocked HTTP server)
//                                ↘ redis-bridge  (fake publish recorder)
//
// Offline portion runs in CI on ubuntu (no daemons, no broker). Live section
// gated on BIGPICKLE_TRIAD_LIVE=1 + cross-vantage acer:6379 + acer:4953.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { predictKPositions } from '../../src/zeta-process.mjs';
import { mtpHeads, preWarmCandidates } from '../../src/mtp-heads.mjs';
import { hrmShapedPrediction } from '../../src/hrm-slow-fast.mjs';
import { PIDChainRevolver } from '../../src/pid-chain-revolver.mjs';
import { durableNotify, cosignAppend } from '../../src/cosign-bridge.mjs';
import { RedisBridge, channelFor } from '../../src/redis-bridge.mjs';

// === Chain link 1: zeta → mtp ===========================================

test('triad: zeta predictKPositions → mtpHeads share cp-trajectory shape', () => {
  const zeta = predictKPositions(500, 1, { seed: 0 });
  const mtp = mtpHeads(500, { k: 4, depth: 1, seed: 0 });
  // Head 0 with seed bit-XOR 0 matches direct zeta call (head_seed = seed ^ 0).
  assert.equal(mtp.heads[0].cp_predicted, zeta.final_cp);
});

// === Chain link 2: mtp → revolver.preWarm ===============================

test('triad: revolver.preWarm consumes MTP candidates → speculative PIDs are 16-hex', () => {
  const rev = new PIDChainRevolver({ anchor: 'TEST-ACER' });
  const out = rev.preWarm({ cp0: 500, k: 4, depth: 1, seed: 0 });
  assert.equal(out.algorithm, 'pid-chain-revolver-mtp-prewarm.v1');
  assert.equal(out.candidates.length, 4);
  for (const c of out.candidates) {
    assert.match(c.speculative_pid, /^[a-f0-9]{16}$/);
    assert.ok(c.cp_predicted >= 2 && c.cp_predicted <= 1023);
    assert.equal(c.bh_coord_predicted.length, 3);
    assert.ok(['nervous', 'circulatory', 'skeletal', 'muscular', 'immune', 'memory', 'lymphatic'].includes(c.lane));
  }
});

test('triad: revolver.preWarm is pure — does NOT advance counter', () => {
  const rev = new PIDChainRevolver({ anchor: 'TEST-ACER' });
  rev.next(); // counter=1
  rev.next(); // counter=2
  const before = rev.counter;
  rev.preWarm({ cp0: 500, k: 4 });
  assert.equal(rev.counter, before, 'preWarm must not mutate counter');
});

// === Chain link 3: hrm shape ↘ mtp position =============================

test('triad: hrm classifies cascade envelope + emits K shape-pulled positions', () => {
  const r = hrmShapedPrediction({
    envelopeType: 'cascade-fanout',
    agentProf: 'VEC',
    currentCp: 500,
    k: 4,
    fastIters: 5,
    seed: 0,
  });
  assert.equal(r.shape, 'cascade');
  assert.equal(r.heads.length, 4);
  for (const h of r.heads) assert.ok(h.cp_predicted >= 2 && h.cp_predicted <= 1023);
});

// === Chain link 4: durableNotify (mocked HTTP cosign + fake Redis) =======

function startMockCosignServer() {
  const calls = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        calls.push({ method: req.method, path: req.url, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          seq: 99,
          row_hash: 'a1b2c3d4e5f60718',
          antecedent_prev: '0000000000000000',
        }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, calls });
    });
  });
}

function fakeRedisBridge() {
  const published = [];
  return {
    publish: async (channel, payload) => {
      published.push({ channel, payload });
      return { ok: true, subscribers: 1 };
    },
    published,
  };
}

test('triad: durableNotify cosign→redis with mocked daemon + fake bridge', async () => {
  const { server, port, calls } = await startMockCosignServer();
  try {
    const fake = fakeRedisBridge();
    const channel = channelFor('acer', 'heartbeat', 'tick');
    const payload = { event: 'tick', vantage: 'acer', ts: '2026-05-25T18:00:00Z' };

    const r = await durableNotify(channel, payload, fake, { host: '127.0.0.1', port });

    // Cosign POST happened first
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].path, '/api/cosign/append');
    assert.deepEqual(JSON.parse(calls[0].body), payload);

    // Redis publish carries cosign receipt
    assert.equal(fake.published.length, 1);
    assert.equal(fake.published[0].channel, channel);
    const pub = JSON.parse(fake.published[0].payload);
    assert.equal(pub.cosign_seq, 99);
    assert.equal(pub.cosign_row, 'a1b2c3d4e5f60718');
    assert.equal(pub.channel, channel);
    assert.equal(pub.event_summary.event, 'tick');
    assert.equal(pub.event_summary.vantage, 'acer');

    // Aggregate result
    assert.equal(r.algorithm, 'durable-notify-cosign-plus-redis.v1');
    assert.equal(r.cosign.ok, true);
    assert.equal(r.publish.ok, true);
    assert.equal(r.durability_gap_status, 'live-and-logged');
  } finally {
    server.close();
  }
});

test('triad: durableNotify flags durability_gap when zero subscribers', async () => {
  const { server, port } = await startMockCosignServer();
  try {
    const noSubs = {
      publish: async () => ({ ok: true, subscribers: 0 }),
    };
    const r = await durableNotify(
      'omni-asolaria/acer/x/y',
      { event: 'tick', vantage: 'acer' },
      noSubs,
      { host: '127.0.0.1', port },
    );
    assert.equal(r.durability_gap_status, 'logged-but-no-live-subscriber');
  } finally {
    server.close();
  }
});

test('triad: durableNotify throws if cosign fails (mocked failure)', async () => {
  const failServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'simulated-failure' }));
  });
  await new Promise((r) => failServer.listen(0, '127.0.0.1', r));
  const port = failServer.address().port;
  try {
    await assert.rejects(
      () => durableNotify('omni-asolaria/x/y/z', { event: 'tick' }, fakeRedisBridge(), { host: '127.0.0.1', port }),
      /cosign append failed/,
    );
  } finally {
    failServer.close();
  }
});

// === Chain link 5: em-dash payload survives Node http (the bug bypass) ===

test('triad: cosignAppend round-trips em-dash payload via mocked daemon', async () => {
  const { server, port, calls } = await startMockCosignServer();
  try {
    const payload = { event: 'em\u2014dash-test', note: 'a\u2014b' };
    const r = await cosignAppend(payload, { host: '127.0.0.1', port });
    assert.equal(r.ok, true);
    // Mock server received the em-dash bytes intact (Node http path-through).
    const echoed = JSON.parse(calls[0].body);
    assert.equal(echoed.event, 'em\u2014dash-test');
    assert.equal(echoed.note, 'a\u2014b');
  } finally {
    server.close();
  }
});

// === LIVE: full bilateral wire (gated) ===================================

const LIVE = process.env.BIGPICKLE_TRIAD_LIVE === '1';
const REDIS_HOST = process.env.OMNI_REDIS_HOST || '192.168.1.50';
const REDIS_PORT = parseInt(process.env.OMNI_REDIS_PORT || '6379', 10);
const REDIS_TOKEN = process.env.OMNI_BILATERAL_TOKEN || null;
const COSIGN_HOST = process.env.COSIGN_HOST || '127.0.0.1';
const COSIGN_PORT = parseInt(process.env.COSIGN_PORT || '4953', 10);

test('LIVE: full triad — zeta→mtp→prewarm→durableNotify (skipped unless BIGPICKLE_TRIAD_LIVE=1)',
  { skip: !LIVE },
  async () => {
    // 1. zeta+mtp+revolver pre-warm (offline math)
    const rev = new PIDChainRevolver({ anchor: 'LIVE-TRIAD-TEST' });
    const warm = rev.preWarm({ cp0: 500, k: 4, depth: 1, seed: 0 });
    assert.equal(warm.candidates.length, 4);

    // 2. live broker + live cosign
    const bridge = new RedisBridge({ host: REDIS_HOST, port: REDIS_PORT, bearer: REDIS_TOKEN });
    await bridge.connect();
    if (REDIS_TOKEN) await bridge.auth();
    try {
      const channel = channelFor('acer', 'test', 'triad-integration');
      const payload = {
        event: 'triad-integration-test',
        vantage: 'acer',
        ts: new Date().toISOString(),
        warm_candidates: warm.candidates.map((c) => c.speculative_pid),
      };
      const r = await durableNotify(channel, payload, bridge, { host: COSIGN_HOST, port: COSIGN_PORT });
      assert.equal(r.cosign.ok, true);
      assert.equal(r.publish.ok, true);
      assert.ok(typeof r.cosign.seq === 'number');
    } finally {
      bridge.close();
    }
  },
);

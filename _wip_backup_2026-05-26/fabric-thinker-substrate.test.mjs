// fabric-thinker integration test — verifies the LIGHTWEIGHT inference path
// works end-to-end against:
//   - mock substrate (offline, always runs)
//   - live substrate (FABRIC_THINKER_LIVE=1 + OMNI_REDIS_TEST=1 + COSIGN_TEST=1)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fireBatch } from '../src/fabric-thinker.mjs';

// === Offline: mock substrate ==============================================

function makeMockRedis() {
  const published = [];
  return {
    published,
    publish: async (channel, payload) => {
      published.push({ channel, payload });
      return { ok: true, subscribers: 1 };
    },
  };
}

function makeMockDurableNotify(mockRedis) {
  let seq = 1000;
  return async (channel, payload, redis) => {
    const result = await redis.publish(channel, JSON.stringify(payload));
    return {
      algorithm: 'durable-notify-mock.v1',
      cosign: { ok: true, seq: ++seq, row_hash: `mock-row-${seq}`, antecedent_prev: `mock-prev-${seq - 1}` },
      publish: result,
      durability_gap_status: 'live-and-logged',
    };
  };
}

describe('fabric-thinker integration — OFFLINE (mock substrate)', () => {
  test('fires a 4-PID batch via mock substrate', async () => {
    const redis = makeMockRedis();
    const notify = makeMockDurableNotify(redis);
    const pids = ['AGT-L5-SUP-GAIA-H0905', 'AGT-L5-SUP-GAIA-H0A81', 'PROF-VERB-CLASSIFY', 'PROF-COSIGN-CHAIN'];
    const result = await fireBatch(pids, (p, i) => `mock-query-${i}`, redis, notify);
    assert.strictEqual(result.batch_stats.count, 4);
    assert.strictEqual(result.seals.length, 4);
    assert.strictEqual(result.fail_count, 0);
    for (const seal of result.seals) {
      assert.ok(seal.cosign_seq > 1000, 'mock seq incremented');
      assert.strictEqual(seal.subscribers, 1);
    }
    assert.strictEqual(redis.published.length, 4);
  });

  test('handles empty batch gracefully', async () => {
    const redis = makeMockRedis();
    const notify = makeMockDurableNotify(redis);
    const result = await fireBatch([], () => 'q', redis, notify);
    assert.strictEqual(result.batch_stats.count, 0);
    assert.strictEqual(result.seals.length, 0);
    assert.strictEqual(result.fail_count, 0);
    assert.strictEqual(result.fail_rate, 0);
  });

  test('throws on bad redisBridge', async () => {
    const notify = makeMockDurableNotify(makeMockRedis());
    await assert.rejects(
      () => fireBatch(['PID'], () => 'q', {}, notify),
      TypeError
    );
  });

  test('throws on bad durableNotifyFn', async () => {
    const redis = makeMockRedis();
    await assert.rejects(
      () => fireBatch(['PID'], () => 'q', redis, null),
      TypeError
    );
  });

  test('counts failures from durableNotify rejections', async () => {
    const redis = makeMockRedis();
    let calls = 0;
    const notify = async () => {
      calls++;
      if (calls % 2 === 0) throw new Error('mock fail');
      return { cosign: { seq: calls, row_hash: `r${calls}`, antecedent_prev: 'p' }, publish: { subscribers: 1 } };
    };
    const result = await fireBatch(['A', 'B', 'C', 'D'], () => 'q', redis, notify);
    assert.strictEqual(result.batch_stats.count, 4);
    assert.strictEqual(result.fail_count, 2);
    assert.strictEqual(result.fail_rate, 0.5);
  });
});

// === LIVE: real substrate (acer broker + cosign daemon) ===================

const LIVE = process.env.FABRIC_THINKER_LIVE === '1';
const LIVE_REDIS_HOST = process.env.OMNI_REDIS_HOST || '127.0.0.1';
const LIVE_REDIS_PORT = parseInt(process.env.OMNI_REDIS_PORT || '6379', 10);
const LIVE_BEARER = process.env.OMNI_BILATERAL_TOKEN || null;

describe('fabric-thinker integration — LIVE (gated FABRIC_THINKER_LIVE=1)', () => {
  test('LIVE: fires real 4-PID batch through cosign+redis substrate', { skip: !LIVE || !LIVE_BEARER }, async () => {
    const { RedisBridge } = await import('../../src/redis-bridge.mjs');
    const { durableNotify } = await import('../../src/cosign-bridge.mjs');
    const redis = new RedisBridge({
      host: LIVE_REDIS_HOST, port: LIVE_REDIS_PORT, vantage: 'acer', bearer: LIVE_BEARER,
    });
    await redis.connect();
    await redis.auth();
    try {
      const pids = ['AGT-L5-SUP-GAIA-H0905', 'PROF-VERB-CLASSIFY', 'PROF-COSIGN-CHAIN', 'PROF-OMNISPINDLE'];
      const result = await fireBatch(
        pids,
        (p, i) => `integration-test-query-${i}`,
        redis,
        durableNotify
      );
      assert.strictEqual(result.batch_stats.count, 4);
      assert.strictEqual(result.seals.length, 4);
      // At least 75% should succeed under normal conditions
      assert.ok(result.fail_rate <= 0.25, `fail rate ${result.fail_rate} too high`);
      for (const seal of result.seals) {
        if (seal.cosign_seq) {
          assert.ok(seal.cosign_seq > 0, 'real seq > 0');
        }
      }
    } finally {
      redis.close();
    }
  });
});

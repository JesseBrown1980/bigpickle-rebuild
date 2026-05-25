// fabric-thinker-gnn — unit tests (pure helpers).
// Live-gated tests run only with FABRIC_THINKER_GNN_LIVE=1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pidQueryToGraph, STATUS } from '../src/fabric-thinker-gnn.mjs';

describe('fabric-thinker-gnn — STATUS', () => {
  test('STATUS is frozen', () => {
    assert.strictEqual(Object.isFrozen(STATUS), true);
  });
  test('STATUS declares compose chain', () => {
    assert.strictEqual(STATUS.schema, 'fabric-thinker-gnn.v1');
    assert.strictEqual(STATUS.composes_with, 'fabric-thinker.descriptorInfer');
  });
  test('STATUS api includes realInfer + checkReady', () => {
    assert.ok(STATUS.api.includes('realInfer'));
    assert.ok(STATUS.api.includes('checkReady'));
    assert.ok(STATUS.api.includes('pidQueryToGraph'));
  });
  test('STATUS lists 4 cascade layers', () => {
    assert.strictEqual(STATUS.cascade_layers.length, 4);
    assert.ok(STATUS.cascade_layers.includes('L0_EdgeLevel'));
    assert.ok(STATUS.cascade_layers.includes('L4_GSLGNN'));
  });
});

describe('fabric-thinker-gnn — pidQueryToGraph', () => {
  test('returns 2 nodes with 6 floats each', () => {
    const g = pidQueryToGraph('PID-TEST', 'hello world');
    assert.strictEqual(g.nodes.length, 2);
    assert.strictEqual(g.nodes[0].length, 6);
    assert.strictEqual(g.nodes[1].length, 6);
    for (const n of g.nodes) for (const f of n) {
      assert.ok(f >= 0 && f <= 1, 'feature ' + f + ' out of [0,1]');
    }
  });
  test('returns 1 edge with 13 features', () => {
    const g = pidQueryToGraph('PID-A', 'q');
    assert.strictEqual(g.edges.length, 1);
    assert.deepStrictEqual(g.edges[0], [0, 1]);
    assert.strictEqual(g.edge_features.length, 1);
    assert.strictEqual(g.edge_features[0].length, 13);
  });
  test('deterministic: same input → same graph', () => {
    const a = pidQueryToGraph('PID-X', 'query-X');
    const b = pidQueryToGraph('PID-X', 'query-X');
    assert.deepStrictEqual(a.nodes, b.nodes);
    assert.deepStrictEqual(a.edge_features, b.edge_features);
    assert.strictEqual(a.edge_hash_sha8, b.edge_hash_sha8);
  });
  test('different PID → different graph', () => {
    const a = pidQueryToGraph('PID-A', 'q');
    const b = pidQueryToGraph('PID-B', 'q');
    assert.notDeepStrictEqual(a.nodes[0], b.nodes[0]);
  });
  test('different query → different graph', () => {
    const a = pidQueryToGraph('PID', 'q1');
    const b = pidQueryToGraph('PID', 'q2');
    assert.notDeepStrictEqual(a.nodes[1], b.nodes[1]);
    assert.notStrictEqual(a.edge_hash_sha8, b.edge_hash_sha8);
  });
  test('returns sha8 metadata fields', () => {
    const g = pidQueryToGraph('PID', 'q');
    assert.match(g.pid_hash_sha8, /^[0-9a-f]{8}$/);
    assert.match(g.query_hash_sha8, /^[0-9a-f]{8}$/);
    assert.match(g.edge_hash_sha8, /^[0-9a-f]{8}$/);
  });
});

// === LIVE: only runs with FABRIC_THINKER_GNN_LIVE=1 ===
const LIVE = process.env.FABRIC_THINKER_GNN_LIVE === '1';

describe('fabric-thinker-gnn — LIVE (gated FABRIC_THINKER_GNN_LIVE=1)', () => {
  test('LIVE: checkReady reports server state', { skip: !LIVE }, async () => {
    const g = await import('../src/fabric-thinker-gnn.mjs');
    const h = await g.checkReady();
    assert.ok(typeof h.ok === 'boolean');
    if (h.ok) {
      assert.ok(h.models_total >= 1);
    }
  });
  test('LIVE: realInfer returns gnn_score when server reachable', { skip: !LIVE }, async () => {
    const g = await import('../src/fabric-thinker-gnn.mjs');
    const r = await g.realInfer('PID-LIVE-TEST', 'classify me');
    if (r.gnn_real) {
      assert.ok(typeof r.gnn_score === 'number');
      assert.ok(r.gnn_score >= 0 && r.gnn_score <= 1);
      assert.ok(['benign', 'suspicious'].includes(r.gnn_verdict));
    } else {
      // Fallback path is also valid (sha-stub returned)
      assert.strictEqual(r.fallback_to_sha_stub, true);
    }
  });
  test('LIVE: realInfer fallback safe when server unreachable', { skip: !LIVE }, async () => {
    const g = await import('../src/fabric-thinker-gnn.mjs');
    const r = await g.realInfer('PID', 'q', { gnn_port: 9999, timeout_ms: 500 });
    assert.strictEqual(r.fallback_to_sha_stub, true);
    assert.ok(typeof r.confidence === 'number');
  });
});

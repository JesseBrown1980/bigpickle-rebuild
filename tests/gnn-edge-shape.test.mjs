// gnn-edge-shape.test.mjs
// Proves that pidQueryToGraph() produces edge_features with exactly 3 elements per edge,
// and nodes with exactly 6 features each — matching what inference_server.py validates.
//
// Run: node --test D:\bigpickle-rebuild\tests\gnn-edge-shape.test.mjs
// Expected before fix: FAIL (edge_features element has 13 items, not 3)
// Expected after fix:  PASS

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pidQueryToGraph } from '../src/fabric-thinker-gnn.mjs';

test('pidQueryToGraph: every node has exactly 6 features', () => {
  const graph = pidQueryToGraph('test-pid-123', 'sample query');
  for (const node of graph.nodes) {
    assert.strictEqual(
      node.length,
      6,
      `expected node length 6, got ${node.length}: ${JSON.stringify(node)}`
    );
  }
});

test('pidQueryToGraph: every edge_features entry has exactly 3 features (Python server requirement)', () => {
  const graph = pidQueryToGraph('test-pid-123', 'sample query');
  assert.ok(
    Array.isArray(graph.edge_features),
    'edge_features must be an array'
  );
  assert.ok(
    graph.edge_features.length > 0,
    'edge_features must have at least one entry'
  );
  for (const ef of graph.edge_features) {
    assert.strictEqual(
      ef.length,
      3,
      `expected edge_features entry length 3, got ${ef.length}: ${JSON.stringify(ef)}`
    );
  }
});

test('pidQueryToGraph: all feature values are normalized in [0, 1]', () => {
  const graph = pidQueryToGraph('acer-pid-9999', 'gnn inference probe');
  for (const node of graph.nodes) {
    for (const v of node) {
      assert.ok(v >= 0 && v <= 1, `node feature out of [0,1]: ${v}`);
    }
  }
  for (const ef of graph.edge_features) {
    for (const v of ef) {
      assert.ok(v >= 0 && v <= 1, `edge feature out of [0,1]: ${v}`);
    }
  }
});

test('pidQueryToGraph: graph has 2 nodes and 1 edge', () => {
  const graph = pidQueryToGraph('pid-abc', 'query-xyz');
  assert.strictEqual(graph.nodes.length, 2, 'must have exactly 2 nodes');
  assert.strictEqual(graph.edges.length, 1, 'must have exactly 1 edge');
  assert.strictEqual(graph.edge_features.length, 1, 'edge_features count must match edges count');
});

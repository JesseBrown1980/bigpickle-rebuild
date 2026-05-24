// Pins: branch outcomes are appended to the GNN edge ledger when
// envelope.record_branches_as_edges is true; otherwise not.
// Spec: 04-AOT-ALGORITHM-OF-THOUGHT.md — "branches recorded as training edges
// for next-cycle GNN refinement."

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAoT } from '../src/aot-runner.mjs';
import { createGNNEdgeLedger } from '../src/gnn-edge-ledger.mjs';

function mockResponse(branches) {
  const scores = branches.map((_, i) => `score:branch-${i}=${i === 0 ? '0.9' : '0.1'}`);
  return [
    '!AOT-RESPONSE-v0',
    'chosen=branch-0',
    ...scores,
    'tokens=6900',
    '!end',
  ].join('\n');
}

function baseEnv() {
  return {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-edges-test',
    task: 'edges-test',
    branches: ['alpha', 'beta', 'gamma'],
    scoring_function: 'gnn-heuristic',
    prune_threshold: 0.3,
  };
}

test('record_branches_as_edges = true appends one edge per branch', async () => {
  const ledger = createGNNEdgeLedger();
  const env = { ...baseEnv(), record_branches_as_edges: true };
  await runAoT(env, { llm: async () => mockResponse(env.branches), gnnEdgeLedger: ledger });
  assert.equal(ledger.size, env.branches.length);
});

test('each edge carries from, to, branch, score, pruned, scoring_function', async () => {
  const ledger = createGNNEdgeLedger();
  const env = { ...baseEnv(), record_branches_as_edges: true };
  await runAoT(env, { llm: async () => mockResponse(env.branches), gnnEdgeLedger: ledger });
  for (const edge of ledger.entries) {
    assert.equal(edge.from, env.pid_anchor);
    assert.match(edge.to, /^[a-f0-9]{16}$/);
    assert.ok(typeof edge.branch === 'string');
    assert.ok(typeof edge.score === 'number');
    assert.ok(typeof edge.pruned === 'boolean');
    assert.equal(edge.scoring_function, 'gnn-heuristic');
  }
});

test('low-scoring branches are marked pruned = true', async () => {
  const ledger = createGNNEdgeLedger();
  const env = { ...baseEnv(), record_branches_as_edges: true };
  await runAoT(env, { llm: async () => mockResponse(env.branches), gnnEdgeLedger: ledger });
  // branch-0 score 0.9 (>= 0.3 threshold) -> NOT pruned
  // branch-1, branch-2 score 0.1 (< 0.3 threshold) -> pruned
  assert.equal(ledger.entries[0].pruned, false);
  assert.equal(ledger.entries[1].pruned, true);
  assert.equal(ledger.entries[2].pruned, true);
});

test('record_branches_as_edges = false (or unset) appends nothing', async () => {
  const ledger = createGNNEdgeLedger();
  const env = baseEnv(); // flag not set
  await runAoT(env, { llm: async () => mockResponse(env.branches), gnnEdgeLedger: ledger });
  assert.equal(ledger.size, 0);
});

test('record flag without ledger dep is silently a no-op (does not throw)', async () => {
  const env = { ...baseEnv(), record_branches_as_edges: true };
  await runAoT(env, { llm: async () => mockResponse(env.branches) });
  // No assertion needed — absence of throw is the contract.
});

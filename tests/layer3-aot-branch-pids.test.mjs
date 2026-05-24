// Pins: each explored branch receives a fresh, mintable, distinct PID.
// Spec: 04-AOT-ALGORITHM-OF-THOUGHT.md — "AoT branches are themselves PIDs."

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAoT } from '../src/aot-runner.mjs';

function mockResponse(branches, tokens = 6900) {
  const scores = branches.map((_, i) => `score:branch-${i}=${(0.1 * (i + 1)).toFixed(2)}`);
  return [
    '!AOT-RESPONSE-v0',
    'chosen=branch-0',
    ...scores,
    `tokens=${tokens}`,
    '!end',
  ].join('\n');
}

test('each branch receives a mintable PID (sha16 hex form)', async () => {
  const env = {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-pids-test',
    task: 'pid-mint test',
    branches: ['x', 'y', 'z', 'w'],
  };
  const result = await runAoT(env, { llm: async () => mockResponse(env.branches) });
  assert.equal(result.branch_pids.length, env.branches.length);
  for (const pid of result.branch_pids) {
    assert.match(pid, /^[a-f0-9]{16}$/);
  }
});

test('branch PIDs are pairwise distinct', async () => {
  const env = {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-distinct',
    task: 'distinct',
    branches: Array.from({ length: 8 }, (_, i) => `branch-${i}`),
  };
  const result = await runAoT(env, { llm: async () => mockResponse(env.branches) });
  const set = new Set(result.branch_pids);
  assert.equal(set.size, env.branches.length, 'collision detected in branch PIDs');
});

test('branch PIDs are deterministic for the same anchor + branch list', async () => {
  const env = {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-deterministic',
    task: 't',
    branches: ['p', 'q', 'r'],
  };
  const a = await runAoT(env, { llm: async () => mockResponse(env.branches) });
  const b = await runAoT(env, { llm: async () => mockResponse(env.branches) });
  assert.deepEqual(a.branch_pids, b.branch_pids);
});

// Pins: token count for a 5-step / 3-path task stays under the AoT budget.
// Spec: 04-AOT-ALGORITHM-OF-THOUGHT.md — ~9x reduction over old CoT.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAoT } from '../src/aot-runner.mjs';

const AOT_BUDGET = 10_000;          // per spec "AoT 5-step 3-path = 6 900 tokens"
const COT_BASELINE = 64_000;        // the old multi-prompt baseline AoT replaces

function mockResponse(branches, tokens) {
  const scoreLines = branches.map((_, i) => `score:branch-${i}=0.5`);
  return [
    '!AOT-RESPONSE-v0',
    'chosen=branch-0',
    ...scoreLines,
    `tokens=${tokens}`,
    '!end',
  ].join('\n');
}

test('token_cost on a 5-step / 3-path query is well under the 10K budget', async () => {
  const env = {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-budget',
    task: '5-step decision',
    branches: ['a', 'b', 'c'],
    max_depth: 5,
    max_branches: 3,
  };
  const llm = async () => mockResponse(env.branches, 6900);
  const result = await runAoT(env, { llm });
  assert.ok(
    result.token_cost < AOT_BUDGET,
    `token_cost ${result.token_cost} >= budget ${AOT_BUDGET}`
  );
});

test('AoT cost is at least 5x cheaper than the CoT baseline', async () => {
  const env = {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-budget',
    task: '5-step decision',
    branches: ['a', 'b', 'c'],
  };
  const llm = async () => mockResponse(env.branches, 6900);
  const result = await runAoT(env, { llm });
  const ratio = COT_BASELINE / result.token_cost;
  assert.ok(ratio >= 5, `cost reduction ratio ${ratio.toFixed(1)}x < 5x`);
});

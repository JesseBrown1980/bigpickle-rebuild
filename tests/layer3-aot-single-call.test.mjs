// Pins: an AoT envelope produces exactly one outbound LLM call.
// Spec: 04-AOT-ALGORITHM-OF-THOUGHT.md — tree search lives inside ONE context.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAoT } from '../src/aot-runner.mjs';

function mockResponse(branches, chosenIdx = 0, tokens = 6900) {
  const scoreLines = branches.map((_, i) =>
    `score:branch-${i}=${i === chosenIdx ? '0.9' : '0.3'}`
  );
  return [
    '!AOT-RESPONSE-v0',
    `chosen=branch-${chosenIdx}`,
    ...scoreLines,
    `tokens=${tokens}`,
    '!end',
  ].join('\n');
}

function baseEnvelope() {
  return {
    envelope_type: 'AOT_QUERY',
    pid_anchor: 'pid-anchor-1234567890abcdef',
    task: 'unit-test task',
    branches: ['alpha', 'beta', 'gamma'],
    scoring_function: 'gnn-heuristic',
  };
}

test('exactly one LLM call per AoT envelope', async () => {
  let calls = 0;
  const llm = async () => {
    calls++;
    return mockResponse(['alpha', 'beta', 'gamma'], 1);
  };
  const result = await runAoT(baseEnvelope(), { llm });
  assert.equal(calls, 1);
  assert.equal(result.llm_calls, 1);
});

test('LLM is called even when branches list is very small (1 branch)', async () => {
  let calls = 0;
  const llm = async () => {
    calls++;
    return mockResponse(['solo'], 0);
  };
  const env = { ...baseEnvelope(), branches: ['solo'] };
  await runAoT(env, { llm });
  assert.equal(calls, 1);
});

test('runAoT throws when llm dep is missing', async () => {
  await assert.rejects(() => runAoT(baseEnvelope(), {}), /llm/i);
});

test('runAoT throws when envelope_type is not AOT_QUERY', async () => {
  const env = { ...baseEnvelope(), envelope_type: 'NOT_AOT' };
  await assert.rejects(() => runAoT(env, { llm: async () => '' }), /AOT_QUERY/);
});

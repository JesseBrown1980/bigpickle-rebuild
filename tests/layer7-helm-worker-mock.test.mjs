// Pins: helm-worker has a pluggable backend (mock by default). The mock
// returns predictable output so the supervisor can be tested without claude-cli
// being credit-available.
//
// Spec: TESTS-PLAN.md Layer 7 — worker backends: mock | claude-cli | http-proxy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, runJob } from '../src/helm-worker.mjs';

test('mock backend returns predictable stdout + zero exit', async () => {
  const w = createWorker({ backend: 'mock' });
  const result = await runJob(w, { prompt: 'anything' });
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.stdout, 'string');
  assert.ok(result.stdout.length > 0);
  assert.equal(result.backend, 'mock');
});

test('mock backend includes the prompt echo so the supervisor can prove flow', async () => {
  const w = createWorker({ backend: 'mock' });
  const result = await runJob(w, { prompt: 'helm-test-12345' });
  assert.match(result.stdout, /helm-test-12345/);
});

test('createWorker rejects unknown backend', () => {
  assert.throws(() => createWorker({ backend: 'nope' }), /unknown backend/);
});

test('runJob captures a synthetic error from a forced-fail mock', async () => {
  const w = createWorker({ backend: 'mock', forceFail: true });
  const result = await runJob(w, { prompt: 'x' });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr || '', /forced-fail/i);
});

// Pins: oracle diff framework — wire-level compare without source-tainting.
// Spec: TESTS-PLAN.md Layer 6.
//
// Stub oracles drive the contract tests. A real oracle (e.g. shelled to the
// quarantined originals) is opt-in via the ASOLARIA_ORACLE_CMD env var; the
// test SKIPS when unset so CI stays clean.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  diffOutputs,
  compareWithOracle,
  isWithinPromotionGate,
} from '../src/oracle-diff.mjs';
import { serializeEnvelope } from '../src/hbp-emitter.mjs';

function sampleEnvelope() {
  return {
    type: 'oracle-diff-test',
    tupleTag: ['a', 'b', 'c'],
    payload: 'identical payload',
    metadata: { k: 'v' },
  };
}

test('diffOutputs reports match=true for identical inputs and divergence=0', () => {
  const buf = Buffer.from('identical-bytes');
  const d = diffOutputs(buf, buf);
  assert.equal(d.match, true);
  assert.equal(d.byteDivergence, 0);
  assert.equal(d.divergencePct, 0);
  assert.equal(d.rebuildSha, d.oracleSha);
});

test('diffOutputs reports match=false with non-zero divergence for different inputs', () => {
  const a = Buffer.from('aaaaaaaa');
  const b = Buffer.from('aaXaaaab');
  const d = diffOutputs(a, b);
  assert.equal(d.match, false);
  assert.ok(d.byteDivergence > 0);
  assert.ok(d.divergencePct > 0);
  assert.notEqual(d.rebuildSha, d.oracleSha);
});

test('diffOutputs accounts for length differences', () => {
  const a = Buffer.from('short');
  const b = Buffer.from('much longer string');
  const d = diffOutputs(a, b);
  assert.equal(d.match, false);
  assert.ok(d.byteDivergence >= Math.abs(a.length - b.length));
});

test('compareWithOracle: matching stub oracle yields match=true', async () => {
  const env = sampleEnvelope();
  const oracle = async (e) => serializeEnvelope(e); // perfect mirror
  const result = await compareWithOracle(env, oracle);
  assert.equal(result.match, true);
  assert.equal(result.byteDivergence, 0);
});

test('compareWithOracle: divergent stub oracle yields match=false with measurable divergence', async () => {
  const env = sampleEnvelope();
  const oracle = async () => 'completely different output';
  const result = await compareWithOracle(env, oracle);
  assert.equal(result.match, false);
  assert.ok(result.divergencePct > 0);
});

test('compareWithOracle rejects non-function oracleFn', async () => {
  await assert.rejects(() => compareWithOracle(sampleEnvelope(), null), /oracleFn/i);
});

test('isWithinPromotionGate: 0.01% gate accepts match, rejects 1% divergence', () => {
  assert.equal(isWithinPromotionGate({ divergencePct: 0 }), true);
  assert.equal(isWithinPromotionGate({ divergencePct: 0.005 }), true);
  assert.equal(isWithinPromotionGate({ divergencePct: 0.05 }), false);
  assert.equal(isWithinPromotionGate({ divergencePct: 1 }), false);
});

test(
  'real oracle diff (opt-in via ASOLARIA_ORACLE_CMD env var)',
  { skip: !process.env.ASOLARIA_ORACLE_CMD },
  async () => {
    const env = sampleEnvelope();
    const oracle = async (e) => {
      const res = spawnSync(process.env.ASOLARIA_ORACLE_CMD, [], {
        input: JSON.stringify(e),
        encoding: 'utf8',
        shell: true,
      });
      if (res.status !== 0) {
        throw new Error(`oracle command exited ${res.status}: ${res.stderr}`);
      }
      return res.stdout;
    };
    const result = await compareWithOracle(env, oracle);
    assert.ok(
      isWithinPromotionGate(result),
      `real oracle divergence ${result.divergencePct.toFixed(4)}% above 0.01% gate`
    );
  }
);

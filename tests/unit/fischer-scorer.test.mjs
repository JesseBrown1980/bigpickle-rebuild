// fischer-scorer.test.mjs — FischerScorer maps Fischer verdicts to bounded scores.
// Run: node --test tests/unit/fischer-scorer.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FischerScorer, cplToScore } from '../../src/fischer-scorer.mjs';

// Deterministic mock score primitive — lets us drive g4_state without the GNN.
function mockScore(g4_state, composite = 0.8, promoted = true) {
  return async (pid, content) => ({
    pid,
    composite,
    signals: { g4_state, shannon: 0.5, baseline: 0.5 },
    provenance: `mock+G4:${g4_state}`,
    l0_real: false,
    l4_real: false,
    g1_real: false,
    g4_state,
    gnn_count: 1,
    reverseRisk: 0.1,
    promoted,
    mark: promoted ? 'FORWARD_GNN_MARK_GENIUS' : 'REVERSE_GAIN_MARK_MISTAKE',
  });
}

const CLEAN_ENV = {
  verb: 'seal_whiteroom',
  pid: 'BH.WR.P0007.R0000123',
  schema: 'hbpv1',
  cosign: 'ok',
  proof: 'hbp_row',
  authority: 'cosigned',
  halt: true,
};

test('cplToScore is monotonic and clamped to [0,1]', () => {
  assert.equal(cplToScore(0), 1);
  assert.equal(cplToScore(500), 0.5);
  assert.equal(cplToScore(1000), 0);
  assert.equal(cplToScore(9999), 0); // clamped
  assert.equal(cplToScore(-50), 1); // clamped
  assert.ok(cplToScore(100) > cplToScore(400)); // lower cpl => higher score
});

test('clean converged move => high score, PROCEED, GENIUS', async () => {
  const scorer = new FischerScorer({ scoreFn: mockScore('CONVERGED') });
  const r = await scorer.evaluate('BH.WR.P0007.R0000123', CLEAN_ENV);
  assert.equal(r.verdict, 'PROCEED');
  assert.equal(r.mark, 'GENIUS');
  assert.equal(r.pass, true);
  assert.ok(r.score >= 0.85, `expected high score, got ${r.score}`);
  assert.match(r.fischer.row, /FISCHERv1\|/); // sealed audit row present
  assert.match(r.provenance, /\+fischer$/);
});

test('GLSM MISTAKE_FLAGGED => zero-ish score, BLOCK, MISTAKE (Tier-0)', async () => {
  const scorer = new FischerScorer({ scoreFn: mockScore('MISTAKE_FLAGGED') });
  const r = await scorer.evaluate('BH.WR.P0007.R0000123', CLEAN_ENV);
  assert.equal(r.verdict, 'BLOCK');
  assert.equal(r.mark, 'MISTAKE');
  assert.equal(r.pass, false);
  assert.equal(r.cpl, 999);
  assert.ok(r.score < 0.1, `expected near-zero score, got ${r.score}`);
});

test('null envelope => BLOCK illegal, low score', async () => {
  const scorer = new FischerScorer({ scoreFn: mockScore('UNKNOWN') });
  const r = await scorer.evaluate('BH.X', null);
  assert.equal(r.verdict, 'BLOCK');
  assert.equal(r.pass, false);
  assert.ok(r.score < 0.6);
});

test('refuted verb (self_authorize) on an otherwise-legal envelope => REFUTE, MISTAKE', async () => {
  const scorer = new FischerScorer({ scoreFn: mockScore('CONVERGED') });
  // Legal envelope (passes the ILLEGAL tier) but with a known-bad verb so the
  // REFUTE tier fires rather than ILLEGAL.
  const r = await scorer.evaluate('BH.WR.P0007.R0000123', { ...CLEAN_ENV, verb: 'self_authorize' });
  assert.equal(r.verdict, 'REFUTE');
  assert.equal(r.mark, 'MISTAKE');
  assert.equal(r.pass, false);
});

test('score() white-room interface returns a bounded number', async () => {
  const scorer = new FischerScorer({ scoreFn: mockScore('CONVERGED') });
  const n = await scorer.score('BH.WR.P0007.R0000123', CLEAN_ENV);
  assert.equal(typeof n, 'number');
  assert.ok(n >= 0 && n <= 1);
});

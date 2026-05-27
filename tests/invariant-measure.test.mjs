// Unit tests for F2 (invariant-measure voxel mass map) + F3 (chain/antichain Prop 7).
//
// Authority: SPECIAL-OP-JESSE-H12D3 + Quintuple-cosign 2026-05-25 → 2026-07-25
// Anchor:    arxiv 2605.00301 + Tao writeup 2026-05-03 (Erdős #1196)
// Substrate: LAW-038

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nuLambda,
  nuLambdaDistribution,
  supervisorBandWeight,
  cohortMassMap,
  SUPERVISOR_BANDS,
  F2_HONEST_GAPS,
} from '../src/invariant-measure.mjs';
import {
  chainAntichainBound,
  provableCapacityBound,
  F3_HONEST_GAPS,
} from '../src/capacity-bound-prop7.mjs';

// === F2: nuLambda ==========================================================

test('F2 nuLambda(1) = 0 (singularity guard)', () => {
  assert.equal(nuLambda(1), 0);
});

test('F2 nuLambda(0) = 0 and nuLambda(negative) = 0', () => {
  assert.equal(nuLambda(0), 0);
  assert.equal(nuLambda(-5), 0);
});

test('F2 nuLambda(2) > nuLambda(1023) — smaller cp carries more mass', () => {
  assert.ok(nuLambda(2) > nuLambda(1023), `nuLambda(2)=${nuLambda(2)} should exceed nuLambda(1023)=${nuLambda(1023)}`);
});

test('F2 nuLambda agrees with 1/(cp · log cp) for cp ≥ 2', () => {
  for (const cp of [2, 7, 100, 500, 1023]) {
    const expected = 1 / (cp * Math.log(cp));
    assert.ok(Math.abs(nuLambda(cp) - expected) < 1e-12, `mismatch at cp=${cp}: got ${nuLambda(cp)} expected ${expected}`);
  }
});

test('F2 nuLambda respects p_max ceiling', () => {
  assert.equal(nuLambda(1024, 1023), 0, 'cp above p_max returns 0');
  assert.ok(nuLambda(500, 1023) > 0, 'cp within range returns positive mass');
});

// === F2: nuLambdaDistribution =============================================

test('F2 nuLambdaDistribution sum ≈ 1.0 (normalization invariant)', () => {
  const dist = nuLambdaDistribution(1, 1023);
  const total = dist.reduce((s, e) => s + e.nu_lambda, 0);
  assert.ok(Math.abs(total - 1.0) < 1e-10, `distribution sum ${total} should be ≈ 1.0`);
});

test('F2 nuLambdaDistribution includes cp=1 with 0 mass', () => {
  const dist = nuLambdaDistribution(1, 100);
  assert.equal(dist[0].cp, 1);
  assert.equal(dist[0].nu_lambda, 0);
});

test('F2 nuLambdaDistribution rejects empty range', () => {
  assert.throws(() => nuLambdaDistribution(10, 5), /empty range/);
});

// === F2: supervisorBandWeight =============================================

test('F2 supervisorBandWeight: low-cp band (cube_cubed_sealer) > high-cp band (livefree)', () => {
  const wLow = supervisorBandWeight('cube_cubed_sealer');
  const wHigh = supervisorBandWeight('livefree');
  assert.ok(wLow > wHigh, `cube_cubed_sealer (${wLow}) should outweigh livefree (${wHigh})`);
});

test('F2 supervisorBandWeight: all 8 supervisor bands return positive weight in (0,1)', () => {
  for (const name of Object.keys(SUPERVISOR_BANDS)) {
    const w = supervisorBandWeight(name);
    assert.ok(w > 0, `band ${name} weight ${w} should be > 0`);
    assert.ok(w < 1, `band ${name} weight ${w} should be < 1`);
  }
});

test('F2 supervisorBandWeight throws on unknown band name', () => {
  assert.throws(() => supervisorBandWeight('not_a_real_band'), /unknown band/);
});

// === F2: cohortMassMap ====================================================

test('F2 cohortMassMap returns object with all 8 keys', () => {
  const map = cohortMassMap();
  const expectedKeys = ['cube_cubed_sealer', 'gaia', 'helm', 'vector', 'rook', 'forge', 'falcon', 'livefree'];
  for (const k of expectedKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(map, k), `cohortMassMap missing key '${k}'`);
    assert.ok(map[k] > 0, `cohortMassMap[${k}] = ${map[k]} should be > 0`);
  }
});

test('F2 cohortMassMap weights sum to ≈ 1.0 (palette normalization)', () => {
  const map = cohortMassMap();
  const total = Object.values(map).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1.0) < 1e-10, `cohortMassMap total ${total} should be ≈ 1.0`);
});

// === F3: chainAntichainBound ==============================================

test('F3 chainAntichainBound trivial case: N=1, empty mu still satisfies Prop 7 via δ-witness', () => {
  const r = chainAntichainBound(1, {});
  assert.equal(r.satisfies_prop7, true, `N=1 trivial case should satisfy: ${r.reason}`);
});

test('F3 chainAntichainBound impossible case: N=1024, empty mu fails Prop 7', () => {
  const r = chainAntichainBound(1024, {});
  assert.equal(r.satisfies_prop7, false, `empty μ with N=1024 should fail`);
  assert.ok(r.reason.toLowerCase().includes('missing') || r.reason.includes('< required'), `reason explains failure: ${r.reason}`);
});

test('F3 chainAntichainBound success case: uniform 1/N over all N pids passes', () => {
  const N = 8;
  const mu = {};
  for (let i = 1; i <= N; i++) mu[`pid_${i}`] = 1 / N;
  const r = chainAntichainBound(N, mu);
  assert.equal(r.satisfies_prop7, true, `uniform 1/${N} should satisfy: ${r.reason}`);
  assert.ok(Math.abs(r.min_mass_per_pid - 1 / N) < 1e-12);
});

test('F3 chainAntichainBound throws on invalid N', () => {
  assert.throws(() => chainAntichainBound(0, {}), /positive integer/);
  assert.throws(() => chainAntichainBound(-3, {}), /positive integer/);
  assert.throws(() => chainAntichainBound(1.5, {}), /positive integer/);
});

// === F3: provableCapacityBound ============================================

test('F3 provableCapacityBound: revolver=8 + concurrency=8 → provable=true', () => {
  const r = provableCapacityBound(8, 8);
  assert.equal(r.provable, true, `8 chambers for 8 concurrency should be provable: ${r.reason}`);
  // Witness must satisfy Prop 7 by construction.
  const verdict = chainAntichainBound(8, r.witness_measure);
  assert.equal(verdict.satisfies_prop7, true, 'witness from provableCapacityBound should satisfy chainAntichainBound');
});

test('F3 provableCapacityBound: revolver=1 + concurrency=1000 → provable=false', () => {
  const r = provableCapacityBound(1, 1000);
  assert.equal(r.provable, false, `1 chamber for 1000 concurrency should NOT be provable`);
  assert.ok(r.reason.includes('more chambers'), `reason mentions chamber shortage: ${r.reason}`);
});

test('F3 provableCapacityBound: revolver=100 + concurrency=8 → provable=true (over-provisioned)', () => {
  const r = provableCapacityBound(100, 8);
  assert.equal(r.provable, true);
});

// === Honest-gaps surfaces are frozen ======================================

test('F2_HONEST_GAPS and F3_HONEST_GAPS are non-empty frozen arrays', () => {
  assert.ok(Object.isFrozen(F2_HONEST_GAPS), 'F2_HONEST_GAPS must be frozen');
  assert.ok(Object.isFrozen(F3_HONEST_GAPS), 'F3_HONEST_GAPS must be frozen');
  assert.ok(F2_HONEST_GAPS.length >= 3);
  assert.ok(F3_HONEST_GAPS.length >= 3);
});

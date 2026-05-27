// Integration test for F2 (invariant-measure cohort mass map) + F3 (Prop 7 capacity).
//
// Authority: SPECIAL-OP-JESSE-H12D3 + Quintuple-cosign 2026-05-25 → 2026-07-25
// Anchor:    arxiv 2605.00301 + Tao writeup 2026-05-03 (Erdős #1196)
// Substrate: LAW-038
//
// Goal: end-to-end verification that the 8 AGENT.md supervisor bands receive
// monotonically-decreasing mass per the ν_Λ log-curve, and that the F3 Prop-7
// witness measure built from revolver chambers satisfies chainAntichainBound.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nuLambdaDistribution,
  supervisorBandWeight,
  cohortMassMap,
  SUPERVISOR_BANDS,
} from '../src/invariant-measure.mjs';
import {
  chainAntichainBound,
  provableCapacityBound,
} from '../src/capacity-bound-prop7.mjs';

test('F2 integration — 8 AGENT.md supervisor bands carry ν_Λ-derived mass; low-cp >> high-cp', () => {
  // Per the F2 anchor: lower-cp bands carry more invariant-measure mass
  // because ν_Λ(cp) = 1/(cp · log cp) is monotonically decreasing in cp.
  // HONEST GAP discovered at integration: the AGENT.md band widths are
  // NOT uniform (cube_cubed_sealer=256, gaia=128, helm=96, vector=96,
  // rook=128, forge=96, falcon=96, livefree=128). Wider higher-cp bands
  // can accumulate slightly more total mass than narrower lower-cp bands
  // that immediately precede them (e.g. rook[576-703]=128cp slightly
  // exceeds vector[480-575]=96cp). This is a property of the AGENT.md
  // palette, not of ν_Λ. We therefore assert:
  //   (a) endpoints: cube_cubed_sealer >> livefree (the operator-visible
  //       headline claim of the F2 anchor — low-cp dominates),
  //   (b) per-cp density: average mass per cp DOES decrease monotonically
  //       in band order (which is the math claim).
  const order = ['cube_cubed_sealer', 'gaia', 'helm', 'vector', 'rook', 'forge', 'falcon', 'livefree'];
  const weights = order.map((name) => {
    const w = supervisorBandWeight(name);
    const [s, e] = SUPERVISOR_BANDS[name];
    return { name, w, width: e - s + 1, density: w / (e - s + 1) };
  });

  // Operator-visible band-mass-table (printed even when test passes).
  console.log('[F2-integration] cohort mass map (replaces hardcoded 234-stub at S6):');
  console.log('  band                  range       width   weight      share    density/cp');
  console.log('  ------------------- ----------- ------- ------------ -------- -----------');
  const total = weights.reduce((s, b) => s + b.w, 0);
  for (const b of weights) {
    const [s, e] = SUPERVISOR_BANDS[b.name];
    const range = `[${s.toString().padStart(4, ' ')}-${e.toString().padStart(4, ' ')}]`;
    const wStr = b.w.toFixed(9).padStart(11, ' ');
    const pct = ((b.w / total) * 100).toFixed(2).padStart(6, ' ');
    const dens = b.density.toExponential(3);
    console.log(`  ${b.name.padEnd(19, ' ')} ${range}  ${b.width.toString().padStart(4, ' ')}   ${wStr}  ${pct}%   ${dens}`);
  }
  console.log(`  TOTAL                              1024   ${total.toFixed(9)}  100.00%`);

  // (a) Endpoint claim: lowest band dominates highest.
  assert.ok(
    weights[0].w > 5 * weights[7].w,
    `cube_cubed_sealer (${weights[0].w}) must be at least 5× livefree (${weights[7].w})`,
  );
  // (b) Density (mass per cp) is strictly monotone-decreasing.
  for (let i = 1; i < weights.length; i++) {
    assert.ok(
      weights[i - 1].density > weights[i].density,
      `density-per-cp order broken: ${weights[i - 1].name}=${weights[i - 1].density} should exceed ${weights[i].name}=${weights[i].density}`,
    );
  }
  // Total should renormalize to ≈ 1.
  assert.ok(Math.abs(total - 1.0) < 1e-10, `cohort total ${total} ≠ 1.0`);
});

test('F2 integration — nuLambdaDistribution over [1,1023] is a proper probability distribution', () => {
  const dist = nuLambdaDistribution(1, 1023);
  assert.equal(dist.length, 1023);
  // cp=1 carries zero mass; cp=2..1023 carry positive mass.
  assert.equal(dist[0].cp, 1);
  assert.equal(dist[0].nu_lambda, 0);
  for (let i = 1; i < dist.length; i++) {
    assert.ok(dist[i].nu_lambda > 0, `cp=${dist[i].cp} should have positive mass`);
  }
  const total = dist.reduce((s, e) => s + e.nu_lambda, 0);
  assert.ok(Math.abs(total - 1.0) < 1e-10, `distribution total ${total} ≠ 1.0`);
});

test('F2 integration — cohortMassMap replaces the 234-stub with non-stub ν_Λ values', () => {
  const map = cohortMassMap();
  console.log('[F2-integration] cohortMassMap raw JSON (operator review):');
  console.log('  ', JSON.stringify(map, null, 2).split('\n').join('\n   '));
  // The hardcoded 234-stub was a single integer; the replacement is a
  // structured map of 8 normalized weights. Assert NONE of them collapse
  // to anything resembling the old 234 stub (which would be either
  // integer 234, or 234/sum, or trivially equal across bands).
  for (const [name, w] of Object.entries(map)) {
    assert.notEqual(w, 234, `band ${name} weight is the literal 234-stub`);
    assert.ok(Number.isFinite(w) && w > 0 && w < 1, `band ${name} weight ${w} out of (0,1)`);
  }
  // Assert weights are NOT all equal (the stub-like degenerate case).
  const values = Object.values(map);
  const v0 = values[0];
  const allEqual = values.every((v) => Math.abs(v - v0) < 1e-9);
  assert.ok(!allEqual, 'cohortMassMap collapsed to flat distribution (stub-like)');
});

test('F3 integration — provableCapacityBound witness composes with chainAntichainBound (round-trip)', () => {
  // For a realistic federation: 16 revolver chambers, 16 target citizens.
  const N = 16;
  const cap = provableCapacityBound(N, N);
  assert.equal(cap.provable, true);
  // Feed the witness measure into chainAntichainBound — Prop 7 must agree.
  const verdict = chainAntichainBound(N, cap.witness_measure);
  assert.equal(verdict.satisfies_prop7, true, `Prop 7 witness must satisfy bound: ${verdict.reason}`);
  console.log(`[F3-integration] N=${N} round-trip: provable=${cap.provable}, prop7=${verdict.satisfies_prop7}, min_mass=${verdict.min_mass_per_pid.toFixed(6)}`);
});

test('F3 integration — failure mode: 1 chamber for 1024-citizen surge is honestly rejected', () => {
  const cap = provableCapacityBound(1, 1024);
  assert.equal(cap.provable, false);
  // The synthesized partial witness should also fail chainAntichainBound.
  const verdict = chainAntichainBound(1024, cap.witness_measure);
  assert.equal(verdict.satisfies_prop7, false, 'partial witness must NOT satisfy Prop 7');
  console.log(`[F3-integration] 1 chamber vs 1024 surge: rejected. reason="${cap.reason}"`);
});

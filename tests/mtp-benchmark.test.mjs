// MTP benchmark harness — empirical measurement of parallel-K speedup,
// hit-rate against synthetic ground truth, and cp=2 sink pathology.
//
// Spec: operator dispatch 2026-05-25 (acer Builder Agent #2, OP-JESSE Quintuple Authority).
// Purpose: decide whether the "x3 speedup like Gemma-4 MTP drafters" claim is
//   empirically justified for this codebase BEFORE the operator builds the
//   drafter+verifier shim or markets the number.
//
// Honesty notes baked in:
//   - "Parallel" K=4 heads in mtp-heads.mjs is a synchronous for-loop in JS.
//     There is no Worker/SharedArrayBuffer/SIMD here, so the only speedup
//     vector is shared per-step setup amortized across K branches. We measure
//     it; we do not assume it.
//   - Synthetic ground truth comes from the SAME algorithm (vonMangoldtNext).
//     A non-zero head will tautologically match itself. We document this and
//     report it as a self-prediction baseline, not external accuracy.
//   - cp=2 is a known absorbing sink per zeta-process.HONEST_GAPS; we quantify
//     how many heads collapse for representative cp0 values.
//
// All metrics are PRINTED via console.log (for operator visibility).
// node:test assertions only check structural invariants (no soft perf gates).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { mtpHeads, preWarmCandidates } from '../src/mtp-heads.mjs';
import { vonMangoldtNext } from '../src/zeta-process.mjs';

// === Deterministic cp0 sample generator ===================================
// Mulberry32 over a fixed seed → 100 cp0 samples from the healthy band
// [50, 900] (per zeta-process.HONEST_GAPS: cp2 sink + depth>=4 collapse
// avoided by staying in the middle band).

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function healthyBandSamples(n, seed) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(50 + Math.floor(rng() * (900 - 50 + 1)));
  }
  return out;
}

function quantile(sortedAsc, q) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(q * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

// === A. Wall-clock speedup ===============================================
// Baseline: 100 trials, each calls vonMangoldtNext 4 times sequentially.
// Parallel: 100 trials, each calls mtpHeads(cp0, {k:4}).
// (Both at depth=1; depth-1 keeps us in the healthy band per HONEST_GAPS.)

const BENCH_SEED = 0x5EEDB16D;
const TRIALS = 100;
const K = 4;
const DEPTH = 1;

test('A. wall-clock speedup: parallel-K=4 mtpHeads vs sequential K=4 vonMangoldtNext', () => {
  const samples = healthyBandSamples(TRIALS, BENCH_SEED);

  // Warm-up — both paths, to make V8 JIT decisions before timing.
  for (let i = 0; i < 50; i++) {
    for (let h = 0; h < K; h++) vonMangoldtNext(samples[i % samples.length], { seed: h, step: 0 });
    mtpHeads(samples[i % samples.length], { k: K, depth: DEPTH, seed: 0 });
  }

  // Baseline trials.
  const baselineTimes = [];
  for (const cp0 of samples) {
    const t0 = performance.now();
    for (let h = 0; h < K; h++) {
      // Mimic K independent heads: vary seed per head, single step.
      vonMangoldtNext(cp0, { seed: (h * 0x9e3779b1) >>> 0, step: 0 });
    }
    const t1 = performance.now();
    baselineTimes.push(t1 - t0);
  }

  // Parallel trials.
  const parallelTimes = [];
  for (const cp0 of samples) {
    const t0 = performance.now();
    mtpHeads(cp0, { k: K, depth: DEPTH, seed: 0 });
    const t1 = performance.now();
    parallelTimes.push(t1 - t0);
  }

  const baseSorted = [...baselineTimes].sort((a, b) => a - b);
  const parSorted = [...parallelTimes].sort((a, b) => a - b);

  const baseMedian = quantile(baseSorted, 0.5);
  const baseP50 = baseMedian;
  const baseP99 = quantile(baseSorted, 0.99);
  const baseMean = mean(baselineTimes);

  const parMedian = quantile(parSorted, 0.5);
  const parP50 = parMedian;
  const parP99 = quantile(parSorted, 0.99);
  const parMean = mean(parallelTimes);

  // ratio < 1 → parallel faster; ratio > 1 → parallel slower
  const meanRatio = baseMean > 0 ? parMean / baseMean : NaN;
  const medianRatio = baseMedian > 0 ? parMedian / baseMedian : NaN;

  console.log('');
  console.log('=== A. Wall-clock speedup (lower ms = faster) ============================');
  console.log(`  trials                 : ${TRIALS}`);
  console.log(`  K                      : ${K}`);
  console.log(`  depth                  : ${DEPTH}`);
  console.log(`  baseline (K seq calls) : median=${baseMedian.toFixed(4)}ms  p50=${baseP50.toFixed(4)}ms  p99=${baseP99.toFixed(4)}ms  mean=${baseMean.toFixed(4)}ms`);
  console.log(`  parallel (mtpHeads K=4): median=${parMedian.toFixed(4)}ms  p50=${parP50.toFixed(4)}ms  p99=${parP99.toFixed(4)}ms  mean=${parMean.toFixed(4)}ms`);
  console.log(`  RATIO  parallel/baseline (mean)   = ${meanRatio.toFixed(3)}   (<1.0 = parallel faster)`);
  console.log(`  RATIO  parallel/baseline (median) = ${medianRatio.toFixed(3)}`);
  if (meanRatio < 1 / 3 - 0.05) {
    console.log('  VERDICT: parallel >=3x faster than sequential K=4 — x3 claim JUSTIFIED empirically');
  } else if (meanRatio < 0.9) {
    console.log('  VERDICT: parallel modestly faster — x3 claim NOT JUSTIFIED (some speedup, less than 3x)');
  } else if (meanRatio < 1.1) {
    console.log('  VERDICT: parallel ~same as sequential — x3 claim NOT JUSTIFIED (no measurable speedup)');
  } else {
    console.log('  VERDICT: parallel SLOWER than sequential — x3 claim NOT JUSTIFIED (overhead dominates)');
  }

  // Structural assertions only — no perf gates.
  assert.equal(baselineTimes.length, TRIALS, 'baseline must produce TRIALS samples');
  assert.equal(parallelTimes.length, TRIALS, 'parallel must produce TRIALS samples');
  for (const t of baselineTimes) assert.ok(Number.isFinite(t) && t >= 0, 'baseline time finite >= 0');
  for (const t of parallelTimes) assert.ok(Number.isFinite(t) && t >= 0, 'parallel time finite >= 0');
});

// === B. Hit-rate against synthetic ground truth ===========================
// Build a deterministic trajectory of 100 cp positions via vonMangoldtNext.
// For each cp_i in the trajectory, predict K=4 candidates and check whether
// the actual cp_{i+1} appears in the K predictions.
//
// Honest framing: candidates derive from the SAME algorithm + a head-seed
// permutation, so some head with seed=0 IS the ground-truth-producing seed.
// That makes this a self-prediction lower bound. Real PID transitions
// (from a recorded federation log) are required for true hit-rate.

test('B. hit-rate against synthetic (self-prediction) ground truth', () => {
  const GT_SEED = 0;       // ground truth uses seed=0, step=0 single-step
  const TRAJ_LEN = 100;
  const PREWARM_SEED = 0;  // candidates use the SAME seed (head 0 will tautologically match)

  // Build ground truth trajectory: start cp0 = 500 (middle of healthy band).
  const truth = [];
  {
    let cur = 500;
    for (let i = 0; i < TRAJ_LEN; i++) {
      const next = vonMangoldtNext(cur, { seed: GT_SEED, step: 0 }).next;
      truth.push({ from: cur, to: next });
      cur = next;
    }
  }

  // For each step, generate K=4 prewarm candidates and check membership.
  let top1Hits = 0;
  let topKHits = 0;
  const headHitDist = new Array(K + 1).fill(0); // index h = "h heads matched truth"
  for (const { from, to } of truth) {
    const prewarm = preWarmCandidates({ cp0: from, k: K, depth: 1, seed: PREWARM_SEED });
    const cps = prewarm.candidates.map((c) => c.cp);

    // top-1: did head_0 predict the actual next cp?
    if (cps[0] === to) top1Hits++;

    // top-K: did ANY of the K heads predict the actual next cp?
    if (cps.includes(to)) topKHits++;

    // How many heads matched?
    let matched = 0;
    for (const cp of cps) if (cp === to) matched++;
    headHitDist[matched]++;
  }

  const top1Rate = top1Hits / TRAJ_LEN;
  const topKRate = topKHits / TRAJ_LEN;

  console.log('');
  console.log('=== B. Hit-rate against synthetic (self-prediction) ground truth =========');
  console.log(`  trajectory length      : ${TRAJ_LEN} steps`);
  console.log(`  ground-truth seed      : ${GT_SEED}`);
  console.log(`  prewarm seed           : ${PREWARM_SEED}`);
  console.log(`  top-1 accuracy (head_0 == truth) : ${(top1Rate * 100).toFixed(1)}%  (${top1Hits}/${TRAJ_LEN})`);
  console.log(`  top-${K} accuracy (any of K==truth) : ${(topKRate * 100).toFixed(1)}%  (${topKHits}/${TRAJ_LEN})`);
  console.log(`  distribution: # heads matching truth per step`);
  for (let i = 0; i <= K; i++) {
    console.log(`    ${i} heads matched : ${headHitDist[i]} / ${TRAJ_LEN}`);
  }
  console.log('  CAVEAT: candidates and truth derive from the SAME vonMangoldtNext.');
  console.log('  This is a self-prediction baseline; real PID transitions required for true hit-rate.');

  // Structural assertions.
  assert.equal(truth.length, TRAJ_LEN);
  assert.ok(top1Hits >= 0 && top1Hits <= TRAJ_LEN);
  assert.ok(topKHits >= 0 && topKHits <= TRAJ_LEN);
  assert.ok(topKHits >= top1Hits, 'topK accuracy must be >= top1');
  let distSum = 0;
  for (const c of headHitDist) distSum += c;
  assert.equal(distSum, TRAJ_LEN, 'distribution must cover all trajectory steps');
});

// === C. cp=2 sink-pathology empirics ======================================
// For representative cp0 values, count how many of K=4 heads collapse to cp=2
// at depth=1 and depth=4. Confirms or refutes the healthy-band claim in
// zeta-process.HONEST_GAPS.

test('C. cp=2 sink-pathology: count collapsed heads across cp0 sweep at depth=1,4', () => {
  const CP0_SWEEP = [2, 3, 5, 10, 50, 100, 500, 900];
  const SINK_VALUE = 2;
  const SEED = 0;

  const results = {}; // cp0 → { depth1: collapsed_count, depth4: collapsed_count, depth1Heads: [...], depth4Heads: [...] }

  for (const cp0 of CP0_SWEEP) {
    const d1 = mtpHeads(cp0, { k: K, depth: 1, seed: SEED });
    const d4 = mtpHeads(cp0, { k: K, depth: 4, seed: SEED });
    const d1Cps = d1.heads.map((h) => h.cp_predicted);
    const d4Cps = d4.heads.map((h) => h.cp_predicted);
    const d1Collapsed = d1Cps.filter((c) => c === SINK_VALUE).length;
    const d4Collapsed = d4Cps.filter((c) => c === SINK_VALUE).length;
    results[cp0] = {
      depth1Cps: d1Cps,
      depth4Cps: d4Cps,
      depth1Collapsed: d1Collapsed,
      depth4Collapsed: d4Collapsed,
    };
  }

  console.log('');
  console.log('=== C. cp=2 sink-pathology empirics =====================================');
  console.log(`  K=${K}, SEED=${SEED}, SINK_VALUE=${SINK_VALUE}`);
  console.log('  cp0   | depth=1 cps               | d1 sink | depth=4 cps               | d4 sink');
  console.log('  ------+---------------------------+---------+---------------------------+--------');
  for (const cp0 of CP0_SWEEP) {
    const r = results[cp0];
    const d1Str = r.depth1Cps.join(',').padEnd(25);
    const d4Str = r.depth4Cps.join(',').padEnd(25);
    console.log(`  ${String(cp0).padStart(4)}  | ${d1Str} | ${r.depth1Collapsed}/${K}     | ${d4Str} | ${r.depth4Collapsed}/${K}`);
  }

  // Summarize: list cp0 with full collapse at each depth.
  const d1FullCollapse = CP0_SWEEP.filter((c) => results[c].depth1Collapsed === K);
  const d4FullCollapse = CP0_SWEEP.filter((c) => results[c].depth4Collapsed === K);
  const d1AnyCollapse = CP0_SWEEP.filter((c) => results[c].depth1Collapsed > 0);
  const d4AnyCollapse = CP0_SWEEP.filter((c) => results[c].depth4Collapsed > 0);
  console.log('');
  console.log(`  depth=1 full-collapse cp0  : [${d1FullCollapse.join(',')}]`);
  console.log(`  depth=1 any-collapse cp0   : [${d1AnyCollapse.join(',')}]`);
  console.log(`  depth=4 full-collapse cp0  : [${d4FullCollapse.join(',')}]`);
  console.log(`  depth=4 any-collapse cp0   : [${d4AnyCollapse.join(',')}]`);

  // Structural assertions: all cps in valid range, no NaN, K heads each.
  for (const cp0 of CP0_SWEEP) {
    const r = results[cp0];
    assert.equal(r.depth1Cps.length, K, `cp0=${cp0} depth=1 must have K heads`);
    assert.equal(r.depth4Cps.length, K, `cp0=${cp0} depth=4 must have K heads`);
    for (const cp of r.depth1Cps) {
      assert.ok(Number.isInteger(cp), `cp0=${cp0} depth=1 cp must be integer; got ${cp}`);
      assert.ok(cp >= 2 && cp <= 1023, `cp0=${cp0} depth=1 cp must be in [2,1023]; got ${cp}`);
    }
    for (const cp of r.depth4Cps) {
      assert.ok(Number.isInteger(cp), `cp0=${cp0} depth=4 cp must be integer; got ${cp}`);
      assert.ok(cp >= 2 && cp <= 1023, `cp0=${cp0} depth=4 cp must be in [2,1023]; got ${cp}`);
    }
  }
});

// === Determinism guard ====================================================
// Two back-to-back invocations with the same args must yield identical output.
// If this fails, the benchmark above is not reproducible.

test('determinism: mtpHeads with fixed (cp0, k, depth, seed) is reproducible', () => {
  const a = mtpHeads(500, { k: 4, depth: 2, seed: 42 });
  const b = mtpHeads(500, { k: 4, depth: 2, seed: 42 });
  assert.deepEqual(a, b, 'identical args must yield identical output');
});

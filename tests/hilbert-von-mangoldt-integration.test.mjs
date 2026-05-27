// Integration test for F1 von Mangoldt chain — synthetic 50-PID transition log.
//
// Authority: SPECIAL-OP-JESSE-H12D3 + Quintuple-cosign 2026-05-25 → 2026-07-25
// Anchor:    arxiv 2605.00301 + Tao writeup 2026-05-03 (Erdős #1196)
//
// NOTE: PIDs in this test are SYNTHETIC (n=128 + offset) — they do NOT shadow real
// federation PIDs. This avoids PID fabrication per AGENT.md L36 ("don't mint real
// PIDs in tests").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vonMangoldt,
  vonMangoldtNext,
  predictKPositions,
} from '../src/hilbert-von-mangoldt.mjs';
import { hilbertDecode } from '../src/hilbert.mjs';

// Build a synthetic transition log: for each starting cp s ∈ {1..50} + base,
// observe the "true next" by running one step of the chain with a fixed oracle
// seed. Then ask predictKPositions to make K=4 predictions with a DIFFERENT seed
// salt — the question is how often the truth lands in the top-K.
const SAMPLE_SIZE = 50;
const K_PREDICT = 4;
const TOP_N = 3;
const N0_BASE = 50; // start cps at 51..100 to avoid trivial n=1 case

// Probabilistic threshold: per the memory note, ≈14% prediction noise at
// BEHCS-1024 scale (1/log(1024) ≈ 0.1443). Hit-rate ≥ 30% requested.
const HIT_RATE_MIN = 0.30;

function buildSyntheticLog(size, base, oracleSeed) {
  const log = [];
  for (let i = 1; i <= size; i++) {
    const cp = base + i;
    // The "true next" is one Λ-weighted draw with the oracle's RNG salted by cp.
    const trueNext = vonMangoldtNext(cp, oracleSeed + cp);
    log.push({ cp, trueNext });
  }
  return log;
}

function topNUnique(predictions, n) {
  // Reduce K predicted cps to the unique top-N (preserving order of first
  // occurrence). For K=4 with high churn this should usually yield ≥ 3.
  const seen = new Set();
  const out = [];
  for (const { cp } of predictions) {
    if (!seen.has(cp)) {
      seen.add(cp);
      out.push(cp);
      if (out.length === n) break;
    }
  }
  return out;
}

test('F1 integration — 50 synthetic PIDs, hit-rate of top-3 predictions over K=4 forecasts', () => {
  const oracleSeed = 0xA501A;          // "asolaria" oracle
  const predictorSeed = 0xBEEF1;       // different salt to avoid trivial seed reuse
  const log = buildSyntheticLog(SAMPLE_SIZE, N0_BASE, oracleSeed);

  let hits = 0;
  let panics = 0;
  let nans = 0;
  let negatives = 0;
  const sampleTransitions = [];

  for (const { cp, trueNext } of log) {
    let predictions;
    try {
      predictions = predictKPositions(cp, K_PREDICT, hilbertDecode, { seed: predictorSeed });
    } catch {
      panics++;
      continue;
    }

    // Honest-fail surface: scan for NaN / negative cps in the output.
    for (const p of predictions) {
      if (!Number.isFinite(p.cp) || Number.isNaN(p.cp)) nans++;
      if (p.cp < 1) negatives++;
    }

    const top3 = topNUnique(predictions, TOP_N);
    if (top3.includes(trueNext)) hits++;

    if (sampleTransitions.length < 3) {
      sampleTransitions.push({ cp, trueNext, predicted: predictions.map((p) => p.cp), top3 });
    }
  }

  const hitRate = hits / SAMPLE_SIZE;

  // Operator-visible report (printed even when test passes; node:test captures).
  console.log('[F1-integration] empirical results:');
  console.log(`  samples              : ${SAMPLE_SIZE}`);
  console.log(`  K predictions/sample : ${K_PREDICT}`);
  console.log(`  hits (truth ∈ top-${TOP_N}) : ${hits}`);
  console.log(`  hit-rate             : ${(hitRate * 100).toFixed(1)}%  (threshold ≥ ${(HIT_RATE_MIN * 100).toFixed(0)}%)`);
  console.log(`  panics               : ${panics}`);
  console.log(`  NaNs                 : ${nans}`);
  console.log(`  negative cps         : ${negatives}`);
  console.log('  first 3 transitions  :');
  for (const t of sampleTransitions) {
    console.log(`    cp=${t.cp}  truth=${t.trueNext}  predicted=${JSON.stringify(t.predicted)}  top3=${JSON.stringify(t.top3)}`);
  }

  assert.equal(panics, 0, 'no panics expected');
  assert.equal(nans, 0, 'no NaN cps expected');
  assert.equal(negatives, 0, 'no negative cps expected');
  assert.ok(
    hitRate >= HIT_RATE_MIN,
    `hit-rate ${(hitRate * 100).toFixed(1)}% below threshold ${(HIT_RATE_MIN * 100).toFixed(0)}%`
  );
});

test('F1 integration — chain absorbs to prime fixed-point (Tao convergence)', () => {
  // Per Tao's writeup, the Λ-weighted chain converges to a prime fixed-point.
  // We assert that ALL 50 synthetic PIDs reach a prime within ≤ 12 steps.
  let convergedCount = 0;
  for (let i = 1; i <= SAMPLE_SIZE; i++) {
    const cp = N0_BASE + i;
    let n = cp;
    for (let step = 0; step < 12; step++) {
      const next = vonMangoldtNext(n, 31337 + step);
      if (next === n && vonMangoldt(n) > 0) { convergedCount++; break; }
      n = next;
    }
  }
  assert.equal(convergedCount, SAMPLE_SIZE, 'all chains should converge to prime fixed-point');
});

test('F1 integration — predictKPositions output schema is stable for downstream consumers', () => {
  // Pin the output shape: array of { cp:int≥1, coord:[x,y,z]∈[0..15]^3, step:int }.
  const out = predictKPositions(120, K_PREDICT, hilbertDecode, { seed: 1 });
  assert.equal(out.length, K_PREDICT);
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'cp'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'coord'));
    assert.ok(Object.prototype.hasOwnProperty.call(r, 'step'));
    assert.equal(r.step, i + 1);
    assert.equal(r.coord.length, 3);
  }
});

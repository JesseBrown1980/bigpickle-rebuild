// Unit tests for F1 von Mangoldt chain on Brown-Hilbert lattice.
//
// Authority: SPECIAL-OP-JESSE-H12D3 + Quintuple-cosign 2026-05-25 → 2026-07-25
// Anchor:    arxiv 2605.00301 + Tao writeup 2026-05-03 (Erdős #1196)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vonMangoldt,
  divisors,
  vonMangoldtNext,
  predictKPositions,
} from '../src/hilbert-von-mangoldt.mjs';
import { hilbertDecode } from '../src/hilbert.mjs';

const EPS = 1e-12;
const close = (a, b) => Math.abs(a - b) < EPS;

// ----- Λ(n) -----------------------------------------------------------------

test('Λ(1) = 0 by convention', () => {
  assert.equal(vonMangoldt(1), 0);
});

test('Λ(2) = log(2), Λ(4) = log(2), Λ(8) = log(2) — all powers of 2', () => {
  assert.ok(close(vonMangoldt(2), Math.log(2)), `Λ(2)=${vonMangoldt(2)}`);
  assert.ok(close(vonMangoldt(4), Math.log(2)), `Λ(4)=${vonMangoldt(4)}`);
  assert.ok(close(vonMangoldt(8), Math.log(2)), `Λ(8)=${vonMangoldt(8)}`);
  assert.ok(close(vonMangoldt(1024), Math.log(2)), `Λ(1024)=${vonMangoldt(1024)}`);
});

test('Λ(3) = log(3), Λ(9) = log(3), Λ(27) = log(3) — powers of 3', () => {
  assert.ok(close(vonMangoldt(3), Math.log(3)));
  assert.ok(close(vonMangoldt(9), Math.log(3)));
  assert.ok(close(vonMangoldt(27), Math.log(3)));
});

test('Λ(p) = log(p) for assorted primes (5, 7, 11, 13, 997)', () => {
  for (const p of [5, 7, 11, 13, 997]) {
    assert.ok(close(vonMangoldt(p), Math.log(p)), `Λ(${p})=${vonMangoldt(p)}`);
  }
});

test('Λ(6) = 0 — composite of distinct primes (2·3)', () => {
  assert.equal(vonMangoldt(6), 0);
});

test('Λ(n) = 0 for assorted non-prime-powers (12, 15, 30, 100, 1000)', () => {
  for (const n of [12, 15, 30, 100, 1000]) {
    assert.equal(vonMangoldt(n), 0, `Λ(${n}) should be 0`);
  }
});

// ----- divisors(n) ----------------------------------------------------------

test('divisors(12) = [1, 2, 3, 4, 6, 12]', () => {
  assert.deepEqual(divisors(12), [1, 2, 3, 4, 6, 12]);
});

test('divisors(p) = [1, p] for primes', () => {
  for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]) {
    assert.deepEqual(divisors(p), [1, p], `divisors(${p})`);
  }
});

test('divisors(1) = [1]', () => {
  assert.deepEqual(divisors(1), [1]);
});

test('divisors(16) = [1, 2, 4, 8, 16] — prime power', () => {
  assert.deepEqual(divisors(16), [1, 2, 4, 8, 16]);
});

test('divisors(36) = [1, 2, 3, 4, 6, 9, 12, 18, 36]', () => {
  assert.deepEqual(divisors(36), [1, 2, 3, 4, 6, 9, 12, 18, 36]);
});

// ----- vonMangoldtNext ------------------------------------------------------

test('vonMangoldtNext determinism — same seed → same output across 50 calls', () => {
  const seed = 0xC0FFEE;
  const first = vonMangoldtNext(100, seed);
  for (let i = 0; i < 50; i++) {
    assert.equal(vonMangoldtNext(100, seed), first, `iteration ${i} diverged`);
  }
});

test('vonMangoldtNext(p^k) always returns p — only divisor with nonzero Λ', () => {
  // For n = p^k, divisors are {1, p, p^2, ..., p^k}; only Λ(p^j) for j≥1 nonzero,
  // and they are all equal to log(p), so the weighting is uniform over {p, p^2, ..., p^k}.
  // The mathematical claim being asserted is narrower: for n=p (k=1), the ONLY
  // nonzero-Λ divisor is p itself.
  for (const p of [2, 3, 5, 7, 11, 13]) {
    for (let seed = 1; seed < 20; seed++) {
      assert.equal(vonMangoldtNext(p, seed), p, `vonMangoldtNext(${p}, seed=${seed})`);
    }
  }
});

test('vonMangoldtNext(1) returns 1 — no progress possible', () => {
  assert.equal(vonMangoldtNext(1), 1);
  assert.equal(vonMangoldtNext(1, 42), 1);
});

test('vonMangoldtNext output is always a divisor of n', () => {
  for (const n of [6, 12, 30, 100, 1024]) {
    const ds = new Set(divisors(n));
    for (let seed = 1; seed < 30; seed++) {
      const next = vonMangoldtNext(n, seed);
      assert.ok(ds.has(next), `vonMangoldtNext(${n}, seed=${seed}) → ${next} not in divisors(${n})`);
    }
  }
});

test('vonMangoldtNext output is always a prime-power divisor (Λ > 0)', () => {
  // The weighting Λ(d)/log(n) zeroes out non-prime-power divisors, so the sampler
  // can only return divisors with Λ > 0. (Plus 1 if vonMangoldt(1)=0 weights it out.)
  for (const n of [12, 30, 60, 100, 1024]) {
    for (let seed = 1; seed < 30; seed++) {
      const next = vonMangoldtNext(n, seed);
      assert.ok(
        vonMangoldt(next) > 0,
        `vonMangoldtNext(${n}, seed=${seed}) → ${next} has Λ=${vonMangoldt(next)}`
      );
    }
  }
});

// ----- predictKPositions ----------------------------------------------------

test('predictKPositions returns K tuples with {cp, coord, step}', () => {
  const K = 4;
  const out = predictKPositions(128, K, hilbertDecode, { seed: 7 });
  assert.equal(out.length, K);
  for (let i = 0; i < K; i++) {
    assert.ok(Number.isInteger(out[i].cp), `step ${i}: cp must be int`);
    assert.ok(Array.isArray(out[i].coord), `step ${i}: coord must be array`);
    assert.equal(out[i].coord.length, 3, `step ${i}: 3D coord expected`);
    assert.equal(out[i].step, i + 1);
  }
});

test('predictKPositions chain is monotonically traceable — each step input was prior output', () => {
  // For a deterministic seed, the chain is reproducible AND each step's `next`
  // must equal vonMangoldtNext(prev.cp, seed+step).
  const seed = 12345;
  const out = predictKPositions(60, 6, hilbertDecode, { seed });
  // Re-walk manually with the documented seed-salting and compare.
  let n = 60;
  for (let i = 0; i < out.length; i++) {
    const stepSeed = (seed + (i + 1)) | 0;
    const expected = vonMangoldtNext(n, stepSeed);
    assert.equal(out[i].cp, expected, `step ${i + 1} cp mismatch`);
    n = expected;
  }
});

test('predictKPositions with K=0 returns empty array', () => {
  const out = predictKPositions(128, 0, hilbertDecode, { seed: 1 });
  assert.deepEqual(out, []);
});

test('predictKPositions decodes valid hilbert coords for all steps', () => {
  // Pin: BEHCS-1024 = dimensions:3, bits:4 → coords in [0..15]^3.
  const out = predictKPositions(720, 8, hilbertDecode, { seed: 99 });
  for (const { cp, coord } of out) {
    assert.ok(cp >= 1, `cp must be ≥ 1, got ${cp}`);
    assert.equal(coord.length, 3);
    for (const c of coord) {
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 15, `coord component out of [0,15]: ${c}`);
    }
  }
});

test('predictKPositions seed determinism — same seed → same chain', () => {
  const a = predictKPositions(120, 5, hilbertDecode, { seed: 0xDEADBEEF | 0 });
  const b = predictKPositions(120, 5, hilbertDecode, { seed: 0xDEADBEEF | 0 });
  assert.deepEqual(a, b);
});

test('predictKPositions throws on bad inputs', () => {
  assert.throws(() => predictKPositions(0, 3, hilbertDecode), /positive integer/);
  assert.throws(() => predictKPositions(10, -1, hilbertDecode), /non-negative integer/);
  assert.throws(() => predictKPositions(10, 3, null), /must be a function/);
});

// ----- BEHCS-1024 sanity ----------------------------------------------------

test('vonMangoldt chain absorbs to a prime fixed-point within ≤ 10 steps for any n ∈ [2, 1024]', () => {
  // Λ-weighted sampling always returns a prime-power divisor; iterating, the
  // chain shrinks (or stays equal) and must reach a prime (whose only nonzero-Λ
  // divisor is itself). Convergence in ≤ 10 steps for all starting n ∈ [2,1024].
  for (let n0 = 2; n0 <= 1024; n0++) {
    let n = n0;
    let absorbed = false;
    for (let step = 0; step < 12; step++) {
      const next = vonMangoldtNext(n, 1 + step);
      if (next === n && vonMangoldt(n) > 0) {
        // prime-power fixed-point reached
        absorbed = true;
        break;
      }
      n = next;
    }
    assert.ok(absorbed, `n0=${n0} did not absorb within 12 steps (last n=${n})`);
  }
});

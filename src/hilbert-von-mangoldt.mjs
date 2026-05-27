// F1 — Position-prediction via von Mangoldt chain on the Brown-Hilbert lattice.
//
// Authority: SPECIAL-OP-JESSE-H12D3 (per cosign chain seq=3390)
// Window:    Quintuple-cosign 2026-05-25 to 2026-07-25
// Substrate: LAW-038 (asolaria_MCP + WebMCP + omnicoder_v2 + fabric_merger + redis_white_room_Triad)
// Anchor:    arxiv 2605.00301 (GPT-5.4 Pro Erdős #1196 proof) +
//            terrytao.wordpress.com/2026/05/03/primitive-sets-and-von-mangoldt-chains-erdos-problem-1196-and-beyond/
// Phase:     1 of 3 (F1+F2+F3 NOW → F4 with HRM training → Phase 3 production)
//
// Algorithm (verbatim from C:/The big new idea.txt):
//   Given:    PID P at hilbert_coord H = [x,y,z]
//   Predict:  next K hilbert_coords {H_1, H_2, ..., H_K}
//   1. Treat P's cp value (1..1024) as n_0
//   2. Divisors of n_0 weighted by Λ(divisor)/log(n_0) → sample next n_1
//   3. cp_1 = n_1; bh_coord_1 = hilbertDecode(cp_1, {dim:3, bits:4})
//   4. Repeat K times → K future positions
//
// von Mangoldt Λ(n):
//   Λ(p^k) = log(p)  for prime p, k ≥ 1
//   Λ(n)   = 0       otherwise
//
// Honest gap surface:
//   - Tao's bound is on integers ≤ x, fixed alphabet. BEHCS-1024 has 1024 cps —
//     finite-N edge cases need numerical verification.
//   - 14% prediction noise expected at BEHCS-1024 scale (≈ 1/log(1024) ≈ 0.144).
//   - Without HRM training (Phase 2), this is a deterministic baseline — no shape prior.

// ----- deterministic PRNG (mulberry32) --------------------------------------
// Used when caller passes a seed for reproducible chain sampling.
function mulberry32(seed) {
  let s = (seed | 0) >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----- von Mangoldt Λ(n) -----------------------------------------------------
// Returns log(p) iff n = p^k for some prime p and k ≥ 1, else 0.
// Λ(1) = 0 by convention.
export function vonMangoldt(n) {
  if (!Number.isInteger(n) || n < 1) return 0;
  if (n === 1) return 0;
  // Find smallest prime factor by trial division up to sqrt(n).
  let p = -1;
  if (n % 2 === 0) {
    p = 2;
  } else {
    const lim = Math.floor(Math.sqrt(n));
    for (let d = 3; d <= lim; d += 2) {
      if (n % d === 0) { p = d; break; }
    }
    if (p === -1) p = n; // n itself is prime
  }
  // Verify n is a pure power of p.
  let m = n;
  while (m % p === 0) m = m / p;
  if (m !== 1) return 0;       // mixed factorisation → Λ = 0
  return Math.log(p);
}

// ----- divisors(n) ----------------------------------------------------------
// Returns sorted array of all positive divisors of n.
// divisors(1) = [1]. Throws on non-positive-integer input.
export function divisors(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`divisors: n must be positive integer (got ${n})`);
  }
  const small = [];
  const large = [];
  const lim = Math.floor(Math.sqrt(n));
  for (let d = 1; d <= lim; d++) {
    if (n % d === 0) {
      small.push(d);
      if (d !== n / d) large.push(n / d);
    }
  }
  return small.concat(large.reverse());
}

// ----- vonMangoldtNext(n, seed) ---------------------------------------------
// Given n, sample the next n' by weighting each divisor d of n by Λ(d) / log(n).
// Per Tao's writeup, the weighted distribution concentrates on prime-power divisors.
//
// seed: integer for deterministic PRNG, or null/undefined → Math.random().
//
// Edge cases:
//   - n === 1 → returns 1 (no progress: only divisor is 1, Λ(1) = 0, log(1) = 0).
//   - n is a prime power p^k → only p has nonzero Λ; sampler returns p with prob 1.
//   - n has no prime-power divisors with positive weight (cannot happen for n ≥ 2,
//     since the smallest prime factor of n always satisfies Λ(p) > 0).
export function vonMangoldtNext(n, seed = null) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`vonMangoldtNext: n must be positive integer (got ${n})`);
  }
  if (n === 1) return 1; // no progress possible
  const logN = Math.log(n);
  if (logN === 0) return n; // defensive: shouldn't reach for n ≥ 2

  const ds = divisors(n);
  const weights = ds.map((d) => vonMangoldt(d) / logN);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return n; // defensive — no positive weight (only n=1)

  const rng = seed == null ? Math.random : mulberry32(seed);
  const u = rng() * total;
  let acc = 0;
  for (let i = 0; i < ds.length; i++) {
    acc += weights[i];
    if (u <= acc) return ds[i];
  }
  return ds[ds.length - 1]; // numerical-safety fallthrough
}

// ----- predictKPositions(n0, k, hilbertDecode, opts) ------------------------
// Walk the von Mangoldt chain K steps from n0, decoding each cp to a Brown-Hilbert
// coordinate via the caller-supplied `hilbertDecode` function.
//
// hilbertDecode: function (cp, decodeOpts) → coord array
//   The caller binds the decoder so we don't hard-couple to src/hilbert.mjs's
//   { dimensions, bits } signature.
//
// opts:
//   { seed?: int|null,                  // PRNG seed (deterministic if set)
//     decodeOpts?: any }                // forwarded to hilbertDecode unchanged
//
// Returns: array of K tuples { cp, coord, step } in chain order, step 1..K.
export function predictKPositions(n0, k, hilbertDecode, opts = {}) {
  if (!Number.isInteger(n0) || n0 < 1) {
    throw new RangeError(`predictKPositions: n0 must be positive integer (got ${n0})`);
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new RangeError(`predictKPositions: k must be non-negative integer (got ${k})`);
  }
  if (typeof hilbertDecode !== 'function') {
    throw new TypeError('predictKPositions: hilbertDecode must be a function');
  }
  const seed = opts.seed == null ? null : opts.seed;
  const decodeOpts = opts.decodeOpts == null ? { dimensions: 3, bits: 4 } : opts.decodeOpts;

  const out = [];
  let n = n0;
  for (let i = 1; i <= k; i++) {
    // Advance the PRNG deterministically per step by salting the seed.
    const stepSeed = seed == null ? null : (seed + i) | 0;
    const next = vonMangoldtNext(n, stepSeed);
    const coord = hilbertDecode(next, decodeOpts);
    out.push({ cp: next, coord, step: i });
    n = next;
  }
  return out;
}

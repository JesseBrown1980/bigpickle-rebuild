// F2 — Invariant-measure-derived voxel mass map (replaces stub-data S6).
//
// Authority:  SPECIAL-OP-JESSE-H12D3 (per cosign chain seq=3390)
// Window:     Quintuple-cosign 2026-05-25 to 2026-07-25
// Substrate:  LAW-038 (asolaria_MCP + WebMCP + omnicoder_v2 + fabric_merger
//                      + redis_white_room_Triad)
// Anchor:     arxiv 2605.00301 (GPT-5.4 Pro Erdős #1196 proof) +
//             terrytao.wordpress.com/2026/05/03/primitive-sets-and-von-mangoldt-chains-erdos-problem-1196-and-beyond/
// Phase:      F2 is phase 1 of 3 (F1+F2+F3 NOW → F4 with HRM training → Phase 3 production)
//
// Anchor verbatim (C:/The big new idea.txt):
//   F2 — Invariant-measure-derived voxel mass map (replaces stub-data S6)
//
//   ν_Λ(cp) = ∫₁^∞ (log cp) / (ζ(s) · cp^s) ds  ≈  1/(cp · log cp)
//
//   Apply to 1024 codepoints:
//     Compute ν_Λ(cp) for cp = 1..1023
//     Result: probability distribution over the entire Atlas
//     Sum of ν_Λ over a supervisor band = supervisor's NATURAL WEIGHT
//     in CONVERGE voting (no more hardcoded 234-stub at S6)
//
// Composition contract:
//   This module DEPENDS-ON the math primitive `nuLambda` exported by
//   src/zeta-process.mjs (Layer-2 verified). We do not redefine the
//   measure here; we package it under the F2 spec's exact API surface
//   (`nuLambda(cp, p_max)`, `nuLambdaDistribution(...)`, `supervisorBandWeight(...)`,
//   `cohortMassMap()`) for the CONVERGE-vote/cohort consumers.
//
// Honest gaps:
//   - Truncation: the integral ∫₁^∞ is approximated by 1/(cp · log cp);
//     formally finite-N corrections O(1/log²cp) are dropped. At cp ≈ 1023
//     residual is ≈ 1/log²(1023) ≈ 0.021.
//   - The normalization sum is taken over cp ∈ [2, p_max]; cp=1 carries
//     no mass because ν_Λ(1) is singular (log 1 = 0).

import { nuLambda as nuLambdaCore } from './zeta-process.mjs';

// === Canonical supervisor band palette (per AGENT.md, 8 bands over 0..1023) ===
// Each band is [start, end] inclusive — covers the BEHCS-1024 atlas exactly.
export const SUPERVISOR_BANDS = Object.freeze({
  cube_cubed_sealer: [0, 255],
  gaia:              [256, 383],
  helm:              [384, 479],
  vector:            [480, 575],
  rook:              [576, 703],
  forge:             [704, 799],
  falcon:            [800, 895],
  livefree:          [896, 1023],
});

// === ν_Λ(cp) ==============================================================
// Returns the invariant measure 1/(cp · log cp) for cp ≥ 2, else 0.
// `p_max` is reserved for callers who want to assert a domain ceiling; the
// pointwise value itself is independent of p_max — only the normalization
// in nuLambdaDistribution uses p_max. Kept in the signature so callers can
// explicitly document the BEHCS-1024 ceiling (default 1023).
export function nuLambda(cp, p_max = 1023) {
  const x = Number(cp);
  if (!Number.isFinite(x) || x < 2) return 0;
  if (Number.isFinite(p_max) && p_max >= 2 && x > p_max) return 0;
  return nuLambdaCore(x);
}

// === nuLambdaDistribution =================================================
// Returns the normalized probability distribution over [cp_range_start, cp_range_end].
// Each entry: { cp, nu_lambda }. Sum of nu_lambda over the entries is ≈ 1.
//
// cp=1 is included as an entry with nu_lambda=0 when the range starts at 1
// (faithful to the F2 anchor "Compute ν_Λ(cp) for cp = 1..1023").
export function nuLambdaDistribution(cp_range_start = 1, cp_range_end = 1023) {
  if (!Number.isFinite(cp_range_start) || !Number.isFinite(cp_range_end)) {
    throw new RangeError('nuLambdaDistribution: range endpoints must be finite numbers');
  }
  if (cp_range_start > cp_range_end) {
    throw new RangeError(`nuLambdaDistribution: empty range (${cp_range_start} > ${cp_range_end})`);
  }
  const raw = [];
  let total = 0;
  for (let cp = cp_range_start; cp <= cp_range_end; cp++) {
    const nu = nuLambda(cp, cp_range_end);
    raw.push({ cp, nu_lambda: nu });
    total += nu;
  }
  if (total === 0) {
    // Degenerate: range carries no mass (e.g., [0,1]). Return zeros.
    return raw;
  }
  // Normalize so the entries sum to 1.
  for (const r of raw) r.nu_lambda = r.nu_lambda / total;
  return raw;
}

// === supervisorBandWeight =================================================
// Given a band name and a palette ({ name: [start, end] }), returns the integral
// (= sum) of the NORMALIZED ν_Λ over that band. Used as CONVERGE vote weight,
// so the result is in [0, 1] and the eight canonical bands sum to 1.
//
// Pass `palette` to override the default SUPERVISOR_BANDS (useful for testing
// or for alternative cohort palettes). The normalization domain is the union
// of all band ranges in the supplied palette (so weights always sum to 1
// over whatever palette is in scope).
export function supervisorBandWeight(band_name, palette = SUPERVISOR_BANDS) {
  if (typeof band_name !== 'string') {
    throw new TypeError('supervisorBandWeight: band_name must be a string');
  }
  if (!palette || typeof palette !== 'object') {
    throw new TypeError('supervisorBandWeight: palette must be an object');
  }
  const band = palette[band_name];
  if (!Array.isArray(band) || band.length !== 2) {
    throw new RangeError(`supervisorBandWeight: unknown band '${band_name}'`);
  }
  const [start, end] = band;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new RangeError(`supervisorBandWeight: invalid band range for '${band_name}': [${start}, ${end}]`);
  }
  // Compute palette-wide ν_Λ total for normalization (so all 8 bands sum to 1).
  let paletteTotal = 0;
  for (const [, [s, e]] of Object.entries(palette)) {
    for (let cp = s; cp <= e; cp++) paletteTotal += nuLambda(cp);
  }
  if (paletteTotal === 0) return 0;
  let bandTotal = 0;
  for (let cp = start; cp <= end; cp++) bandTotal += nuLambda(cp);
  return bandTotal / paletteTotal;
}

// === cohortMassMap ========================================================
// Returns an object keyed by the 8 canonical supervisor bands, mapping each
// to its ν_Λ-derived CONVERGE vote weight. Replaces the hardcoded 234-stub
// at S6. Weights sum to ≈ 1.0 across the eight bands.
export function cohortMassMap(palette = SUPERVISOR_BANDS) {
  const out = {};
  for (const name of Object.keys(palette)) {
    out[name] = supervisorBandWeight(name, palette);
  }
  return out;
}

// === Honest gaps surface ==================================================
export const F2_HONEST_GAPS = Object.freeze([
  'ν_Λ(cp) is truncated to the leading term 1/(cp · log cp); next-order O(1/log²cp) corrections dropped (≈2% residual at cp=1023).',
  'p_max default 1023 ties the measure to BEHCS-1024; if the atlas grows the palette ranges and p_max must be updated together.',
  'cohortMassMap weights are normalized over the SUPERVISOR_BANDS palette union; partial palettes (subset of bands) will renormalize differently — operator must pin palette before vote.',
  'F2 replaces the 234-stub at S6 but does NOT validate downstream CONVERGE vote-counting; the consumer site still needs an integration sweep.',
  'AGENT.md band widths are non-uniform (256/128/96/96/128/96/96/128). Total band mass is NOT strictly monotone-decreasing in cp; only per-cp DENSITY is. A wider band at higher cp (e.g. rook[576-703]=128cp) can carry more total mass than a narrower band at lower cp (e.g. vector[480-575]=96cp). Operators using band totals for CONVERGE voting should weight by density × width as needed.',
]);

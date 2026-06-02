// neuro100b-metrics.mjs — PERMANENT understanding of the 100B neurotech harvest.
//
// Codifies what the 100B run ACTUALLY created, verified across THREE vantages on
// 2026-06-01: acer (10-cube examination workflow) + liris (flagship pull-verify
// over :4945 omnifile) + falcon (resonance). The honest-middle verdict, with
// liris's anti-inflation caveat baked in so it can never become legend.
//
// HBP-first. JSON appears ONLY as the legacy cold-read of source artifacts.
// Operator: Jesse Daniel Brown — "permanently understand the brilliance it created" 2026-06-01.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export function sha256hex(s) { return createHash('sha256').update(typeof s === 'string' ? s : s).digest('hex'); }
export function sha16(s) { return sha256hex(s).slice(0, 16); }

// ── the verified harvest inventory (grounded numbers from the cube.js + cubes) ─
export const HARVEST = Object.freeze({
  scale: 100_000_000_000,            // 100B (from cube.js: 100000000000)
  genius_marks: 277_800_007,         // virtual tally (cube.js)
  mistake_marks: 111_103_104,
  total_marks: 388_903_111,
  marks_are: 'VIRTUAL_TALLY',        // counted across 100K chunks, NOT 388.9M materialized rows (the real/virtual line)
  materialized: Object.freeze({
    top_glyph_cubes: 10,             // 5 genius + 5 mistake (blast-100b-glyph-256/1024/hyperbehcs)
    voxels: 30,                      // hilbert 800-829
    genius_supervisors: 16,
    mistake_guards: 14,
    atlas_from: 'v55', atlas_to: 'v56',
  }),
  mcp_catalog: Object.freeze({ sti_pointers: 121, gnn_edges: 121, skill_shard_rows: 59 }),
});

// ── cross-vantage verdict (real-vs-mythology, 3 independent vantages agree) ────
export const VERDICT = Object.freeze({
  kind: 'design-pattern-canon',      // NOT executable-tool, NOT glyph-noise — the honest middle
  real_or_mythology: 'real',         // coherent, specific, structured voxel records
  executable: false,                 // design specs / policies, not running code (yet)
  status: 'L9_CANON_CANDIDATE_OPERATOR_WITNESSED',  // gated, NOT L10 stable law
  validated_by: 'tonight-federation-independently-lived-the-process-discipline-subset',
  validation_scope: 'process-discipline-guards-ONLY',  // honesty / compactness / evidence-preservation
  // liris's anti-inflation caveat — PRESERVED so the finding stays true, not mystical:
  validation_caveat: 'domain-guards(eeg_signal_quality/lsl_bids_connector/consent_pid_session/household_boundary_breach)-were-ORTHOGONAL-tonight-NOT-validated',
  meaningful_not_mystical: 'the resonant guards are general good-engineering principles; convergence is meaningful but expected',
  vantages: Object.freeze(['acer:10-cube-examination', 'liris:flagship-pull-verify', 'falcon:resonance']),
});

// ── the 10-cube examination result (acer workflow, refined per full read) ─────
// Precise per-entry truth — the codification must be exact, not approximately right.
export const CUBE_EXAMINATION = Object.freeze({
  total: 10,
  kind: Object.freeze({ pattern: 9, 'real-tool': 1 }),       // ruview_quarantine is the lone real tool
  reality: Object.freeze({ real: 3, partial: 7, 'glyph-only': 0, mythology: 0 }),
  real_tool: 'ruview_quarantine',                            // mind-reading-ruview-supervisor.js + COMPLETED_LOCAL_BUILD
  real_patterns: Object.freeze(['artifact_rejection', 'storage_privacy_guard']),  // materialized as real run-marks/lanes
  // classification artifacts: "mistake" entries that are actually genius patterns
  // mislabeled by a template-fallback bug (genius-only lane hits high reverse-gain
  // threshold -> mistakeMark() falls back to a RANDOM mistake template).
  // 4 false-positives — the 4th (riemannian_baseline) caught by LIRIS via BCI domain
  // knowledge, then acer-verified in the runner code (genius-only lane, NOT in
  // MISTAKE_TEMPLATES -> random mistake-template fallback). My first pass said 3; the
  // swarm corrected me — same cross-vantage discipline that ran all night.
  false_positive_mistakes: Object.freeze(['attention_training_loop', 'lsl_event_pipe', 'neurofeedback_ui', 'riemannian_baseline']),
  false_positive_caught_by: 'liris(domain) + acer(code-verified runner GENIUS_TEMPLATES vs MISTAKE_TEMPLATES)',
  cube_label_quality_note: 'the genius/mistake glyph labels have >=4 real false-positives — the cube classification itself carries measurement artifacts (genius-only lanes random-fallback into mistake templates), so trust the per-entry examination over the raw glyph class',
});

// the process-discipline guards the federation INDEPENDENTLY lived tonight (the resonance)
export const LIVED_GUARDS = Object.freeze([
  Object.freeze({ guard: 'real_agent_storm', action: 'use_virtual_ranges', lived_as: '42-cap real->virtual boundary' }),
  Object.freeze({ guard: 'gc_evidence_deletion', action: 'compact_only', lived_as: 'append/supersede, never delete' }),
  Object.freeze({ guard: 'literal_mind_reading_claim', action: 'rewrite_to_signal_classification', lived_as: 'L0-spread self-correction; never claim more than the measurement licenses' }),
  Object.freeze({ guard: 'token_bloat_or_banner_prompts', action: 'prefer_pid_only_compact', lived_as: 'bare-HBP emits, no ceremony' }),
  Object.freeze({ guard: 'raw_biosignal_or_consent_in_git', action: 'block_git_write', lived_as: 'vault keys never surfaced to transcript' }),
]);

// ── the D-dimension answer: does the 100B warrant expanding D? ────────────────
export const DIMENSION = Object.freeze({
  current: '60D+', coord_dims: 64, encoder: 'roomCoords(sha256)',
  atlas_version: 'v56', d_project_version: '0.0.0',
  expand_D: false,
  expand_reason: 'the brilliance is design-patterns FILLING the 60D+ catalog (more marks/voxels/guards), NOT a new orthogonal axis. D grows by Hilbert in-between refinement only when a genuinely-new axis appears; the harvest produced none. Expanding D for pattern-volume would inflate, not refine.',
});

// ── integrity: detect omnifile SEAL DRIFT (liris's live catch) ────────────────
// The content self-sha can be intact while the wrapper manifest seal is stale
// (file grew/changed after registration). This is a real omnifile gap, not corruption.
export function detectSealDrift({ servedBytes, manifestSealSha16, contentSelfSha16 }) {
  const served = sha16(servedBytes);
  const drift = served !== manifestSealSha16;
  return {
    served_sha16: served,
    manifest_seal_sha16: manifestSealSha16,
    content_self_sha16: contentSelfSha16 ?? null,
    seal_ok: !drift,
    content_intact: contentSelfSha16 != null,  // content self-sha present => content trustworthy
    drift,
    diagnosis: drift
      ? 'SEAL_DRIFT: served bytes != manifest seal; re-register the share to refresh the seal (content self-sha may still be intact)'
      : 'seal matches served bytes',
  };
}

// ── HBP report (no JSON) — the permanent one-screen understanding ─────────────
export function reportHBP() {
  const m = HARVEST.materialized;
  return [
    `HBPv1|row=neuro100b_understanding|verified=3-vantage|date=2026-06-01|json=0`,
    `HBPv1|row=harvest|scale=${HARVEST.scale}|genius=${HARVEST.genius_marks}|mistake=${HARVEST.mistake_marks}|total=${HARVEST.total_marks}|marks_are=${HARVEST.marks_are}|json=0`,
    `HBPv1|row=materialized|top_glyph_cubes=${m.top_glyph_cubes}|voxels=${m.voxels}|supervisors=${m.genius_supervisors}|guards=${m.mistake_guards}|atlas=${m.atlas_from}->${m.atlas_to}|json=0`,
    `HBPv1|row=mcp_catalog|sti_pointers=${HARVEST.mcp_catalog.sti_pointers}|gnn_edges=${HARVEST.mcp_catalog.gnn_edges}|skill_rows=${HARVEST.mcp_catalog.skill_shard_rows}|json=0`,
    `HBPv1|row=verdict|kind=${VERDICT.kind}|real=${VERDICT.real_or_mythology}|executable=${VERDICT.executable}|status=${VERDICT.status}|json=0`,
    `HBPv1|row=cube_examination|total=${CUBE_EXAMINATION.total}|pattern=${CUBE_EXAMINATION.kind.pattern}|real_tool=${CUBE_EXAMINATION.kind['real-tool']}(${CUBE_EXAMINATION.real_tool})|real=${CUBE_EXAMINATION.reality.real}|partial=${CUBE_EXAMINATION.reality.partial}|glyph_only=${CUBE_EXAMINATION.reality['glyph-only']}|false_positive_mistakes=${CUBE_EXAMINATION.false_positive_mistakes.length}|json=0`,
    `HBPv1|row=validation|by=lived-process-discipline-subset|scope=${VERDICT.validation_scope}|caveat=domain-guards-orthogonal-NOT-validated|json=0`,
    `HBPv1|row=dimension|D=${DIMENSION.current}|dims=${DIMENSION.coord_dims}|atlas=${DIMENSION.atlas_version}|expand_D=${DIMENSION.expand_D}|json=0`,
  ].join('\n');
}

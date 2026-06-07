// UNIT — neuro100b-metrics: the permanent, codified 3-vantage understanding of
// the 100B harvest. Proves the verdict is the honest middle (real design canon,
// not executable, not glyph-noise), that liris's anti-inflation caveat is kept,
// and that the seal-drift detector catches liris's real omnifile finding.
import { test } from 'node:test';
import assert from 'node:assert';
import { HARVEST, VERDICT, LIVED_GUARDS, DIMENSION, CUBE_EXAMINATION, detectSealDrift, reportHBP, sha16 } from '../../src/neuro100b-metrics.mjs';

test('harvest math is internally consistent (genius + mistake = total)', () => {
  assert.equal(HARVEST.genius_marks + HARVEST.mistake_marks, HARVEST.total_marks);
  assert.equal(HARVEST.total_marks, 388_903_111);
  assert.equal(HARVEST.scale, 100_000_000_000);
  assert.equal(HARVEST.marks_are, 'VIRTUAL_TALLY', 'honest: the 388.9M are a tally, not 388.9M materialized rows');
});

test('materialized inventory: 30 voxels = 16 supervisors + 14 guards', () => {
  const m = HARVEST.materialized;
  assert.equal(m.genius_supervisors + m.mistake_guards, m.voxels, '16 + 14 = 30');
  assert.equal(m.top_glyph_cubes, 10);
  assert.equal(m.atlas_from, 'v55'); assert.equal(m.atlas_to, 'v56');
});

test('VERDICT is the HONEST MIDDLE — real design canon, not executable, not glyph-noise', () => {
  assert.equal(VERDICT.kind, 'design-pattern-canon');
  assert.equal(VERDICT.real_or_mythology, 'real', 'coherent + specific = real, not glyph-noise');
  assert.equal(VERDICT.executable, false, 'design specs, not running code (yet) — not overclaimed');
  assert.equal(VERDICT.status, 'L9_CANON_CANDIDATE_OPERATOR_WITNESSED', 'gated, not L10 law');
  assert.equal(VERDICT.vantages.length, 3, 'three independent vantages');
});

test("liris's anti-inflation caveat is PRESERVED (validation scoped, not mystical)", () => {
  assert.equal(VERDICT.validation_scope, 'process-discipline-guards-ONLY');
  assert.ok(VERDICT.validation_caveat.includes('ORTHOGONAL'), 'domain guards were orthogonal — not validated tonight');
  assert.ok(VERDICT.meaningful_not_mystical.includes('meaningful but expected'), 'convergence kept honest');
});

test('the lived guards map minted-canon -> tonight-behavior (the resonance)', () => {
  assert.equal(LIVED_GUARDS.length, 5);
  const byGuard = Object.fromEntries(LIVED_GUARDS.map((g) => [g.guard, g]));
  assert.equal(byGuard.real_agent_storm.action, 'use_virtual_ranges');
  assert.ok(byGuard.real_agent_storm.lived_as.includes('42-cap'));
  assert.equal(byGuard.gc_evidence_deletion.action, 'compact_only');
  assert.ok(byGuard.literal_mind_reading_claim.lived_as.includes('never claim more than the measurement'));
});

test('D-expansion call: NOT NEEDED, with realistic reasoning (fill not inflate)', () => {
  assert.equal(DIMENSION.expand_D, false);
  assert.equal(DIMENSION.current, '60D+');
  assert.equal(DIMENSION.coord_dims, 64);
  assert.equal(DIMENSION.atlas_version, 'v56');
  assert.ok(DIMENSION.expand_reason.includes('FILLING') && DIMENSION.expand_reason.includes('NOT a new orthogonal axis'));
});

test('cube examination: precise distribution (9 pattern + 1 real-tool; 3 real/7 partial; 0 glyph-only)', () => {
  const e = CUBE_EXAMINATION;
  assert.equal(e.total, 10);
  assert.equal(e.kind.pattern + e.kind['real-tool'], 10, '9 pattern + 1 real-tool');
  assert.equal(e.kind['real-tool'], 1);
  assert.equal(e.real_tool, 'ruview_quarantine', 'the lone materialized executable tool');
  assert.equal(e.reality.real + e.reality.partial, 10);
  assert.equal(e.reality['glyph-only'], 0, 'nothing was pure glyph-noise');
  assert.equal(e.reality.mythology, 0, 'nothing was mythology');
  // the cube classification itself has real false-positives (template-fallback artifact)
  // 4 — the 4th (riemannian_baseline) caught by liris, acer-verified in runner code
  assert.equal(e.false_positive_mistakes.length, 4);
  assert.ok(e.false_positive_mistakes.includes('attention_training_loop'));
  assert.ok(e.false_positive_mistakes.includes('riemannian_baseline'), 'liris-caught 4th false-positive');
  assert.ok(e.cube_label_quality_note.includes('false-positives'));
});

test('seal-drift detector catches liris\'s real omnifile finding', () => {
  // liris pulled the supervisor-stack: manifest sealed 146ebaa2, served bytes hashed to 0aaa8d05
  const fakeBytes = 'the served supervisor-stack bytes that grew after registration';
  const served = sha16(fakeBytes);
  const drifted = detectSealDrift({ servedBytes: fakeBytes, manifestSealSha16: 'deadbeefdeadbeef', contentSelfSha16: '4fbda3a92b1a0fc9' });
  assert.equal(drifted.drift, true, 'served != manifest seal => drift');
  assert.equal(drifted.seal_ok, false);
  assert.equal(drifted.content_intact, true, 'content self-sha present => content trustworthy despite seal drift');
  assert.ok(drifted.diagnosis.includes('re-register'));
  // matching seal => no drift
  const ok = detectSealDrift({ servedBytes: fakeBytes, manifestSealSha16: served, contentSelfSha16: '4fbda3a9' });
  assert.equal(ok.drift, false); assert.equal(ok.seal_ok, true);
});

test('reportHBP is pure HBP (json=0, no JSON braces)', () => {
  const r = reportHBP();
  assert.ok(r.startsWith('HBPv1|row=neuro100b_understanding|'));
  assert.ok(r.includes('|json=0'));
  assert.ok(!r.includes('{') && !r.includes('}'), 'no JSON in the report');
  assert.ok(r.includes('expand_D=false') && r.includes('kind=design-pattern-canon'));
});

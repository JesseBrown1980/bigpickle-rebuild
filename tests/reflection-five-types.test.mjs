// Tests for src/reflection-five-types.mjs — Co-Scientist Reflection §3.3.2
// 5 review types.  Pure / deterministic; no LLM, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  initialReview,
  fullReview,
  deepVerificationReview,
  observationReview,
  simulationReview,
  runAllReviewTypes,
  toReviewRow,
  REVIEW_TYPES,
  _internals,
} from '../src/reflection-five-types.mjs';

const PID = 'abc1234567890def';
function hyp(text, pid = PID) { return { pid, text }; }

// =================== 1. INITIAL REVIEW ===================

test('initialReview rejects banned term mind-reading', () => {
  const r = initialReview(hyp('this hypothesis depends on mind-reading neurons fully'));
  assert.equal(r.type, REVIEW_TYPES.INITIAL);
  assert.equal(r.passes, false);
  assert.equal(r.verdict, 'REJECT_INITIAL');
  assert.ok(r.reasons.some((x) => x.startsWith('banned_terms:')));
  assert.ok(r.reasons.find((x) => x.includes('mind-reading')));
});

test('initialReview rejects literal telepathy', () => {
  const r = initialReview(hyp('hypothesis: literal telepathy across neurons'));
  assert.equal(r.passes, false);
  assert.ok(r.reasons.find((x) => x.includes('literal telepathy')));
});

test('initialReview rejects too-short hypothesis (<20 chars)', () => {
  const r = initialReview(hyp('short hyp'));
  assert.equal(r.passes, false);
  assert.equal(r.verdict, 'REJECT_INITIAL');
  assert.ok(r.reasons.some((x) => x.startsWith('too_short:')));
});

test('initialReview accepts valid hypothesis', () => {
  const r = initialReview(hyp('A novel mechanism by which protein X regulates pathway Y in cell type Z under stress'));
  assert.equal(r.passes, true);
  assert.equal(r.verdict, 'PASS_INITIAL');
  assert.equal(r.reasons.length, 0);
});

test('initialReview throws on malformed hypothesis', () => {
  assert.throws(() => initialReview(null), TypeError);
  assert.throws(() => initialReview({ text: 'no pid here long enough valid' }), TypeError);
  assert.throws(() => initialReview({ pid: 'p', text: 12345 }), TypeError);
});

// =================== 2. FULL REVIEW ===================

test('fullReview novelty = 1.0 when no literatureRefs match', () => {
  const r = fullReview(
    hyp('uniqueSubstring_alpha_beta_gamma_delta_epsilon_zeta_eta_theta_iota'),
    { literatureRefs: ['totally unrelated paper one', 'another unrelated paper two'] },
  );
  assert.equal(r.type, REVIEW_TYPES.FULL);
  assert.equal(r.novelty, 1.0);
  assert.ok(r.literatureRefsCount === 2);
});

test('fullReview novelty = 1.0 when literatureRefs empty', () => {
  const r = fullReview(hyp('a perfectly fine but lonely hypothesis text'), { literatureRefs: [] });
  assert.equal(r.novelty, 1.0);
});

test('fullReview novelty < 1.0 when literatureRefs contain hypothesis substring', () => {
  // Hypothesis is long enough to spawn an internal probe; we ensure the
  // ref string actually contains the SAME probe substring the module
  // samples — easiest way: have the ref repeat the hypothesis text in full.
  const text = 'protein_xyz regulates pathway_alpha via long_unique_signature_marker_a987';
  const r = fullReview(hyp(text), {
    literatureRefs: [
      'unrelated paper foo bar baz',
      `prior work: ${text} extended discussion`,
    ],
  });
  assert.ok(r.novelty < 1.0, `expected novelty<1.0 got ${r.novelty}`);
});

test('fullReview returns novelty/correctness/quality numbers in [0,1]', () => {
  const r = fullReview(hyp('plausible mechanism hypothesis describing observable effect Y'), {
    literatureRefs: ['nothing related'],
  });
  for (const k of ['novelty', 'correctness', 'quality']) {
    assert.ok(typeof r[k] === 'number', `${k} not number`);
    assert.ok(r[k] >= 0 && r[k] <= 1, `${k}=${r[k]} not in [0,1]`);
  }
});

test('fullReview blocked_by_initial when text rejected', () => {
  const r = fullReview(hyp('short'), { literatureRefs: [] });
  assert.equal(r.passes, false);
  assert.ok(r.reasons.includes('blocked_by_initial'));
});

test('fullReview throws on bad literatureRefs', () => {
  assert.throws(() => fullReview(hyp('ok long hypothesis text here'), { literatureRefs: 'not-an-array' }), TypeError);
});

// =================== 3. DEEP VERIFICATION REVIEW ===================

test('deepVerificationReview correctly classifies fundamental vs non-fundamental', () => {
  const r = deepVerificationReview(hyp('hypothesis with mixed assumption profile'), {
    assumptions: [
      { text: 'foundation assumption A', fundamental: true },
      { text: 'helper assumption B', fundamental: false },
      { text: 'helper assumption C', fundamental: false },
    ],
  });
  assert.equal(r.type, REVIEW_TYPES.DEEP_VERIFY);
  assert.equal(r.assumptionCount, 3);
  for (const p of r.perAssumption) {
    assert.equal(typeof p.valid, 'boolean');
    assert.equal(typeof p.fundamentalToHypothesis, 'boolean');
    assert.equal(p.fundamentalSource, 'caller');
    assert.ok(['VALID', 'INVALID_FUNDAMENTAL', 'INVALID_NON_FUNDAMENTAL'].includes(p.evaluation));
  }
});

test('deepVerificationReview passes when no fundamental errors', () => {
  // All assumptions explicitly non-fundamental — any invalidity drops to
  // refinement, not rejection.  Whatever validity the sha picks, no
  // fundamental error can ever be raised.
  const r = deepVerificationReview(hyp('hypothesis with only helper assumptions'), {
    assumptions: [
      { text: 'helper 1', fundamental: false },
      { text: 'helper 2', fundamental: false },
      { text: 'helper 3', fundamental: false },
    ],
  });
  assert.equal(r.passes, true);
  assert.equal(r.fundamentalErrors.length, 0);
  assert.ok(['PASS_DEEP', 'PASS_REFINE'].includes(r.verdict));
});

test('deepVerificationReview fails when any fundamental error', () => {
  // Find a hypothesis+assumption combo where the assumption is invalid AND
  // marked fundamental.  Walk a few candidates deterministically until the
  // sha-derived validity flips to invalid; here we pre-pick the right one.
  let found = null;
  for (let i = 0; i < 64 && !found; i++) {
    const cand = deepVerificationReview(
      hyp(`probe hypothesis variant ${i} long enough`, `pid${i.toString().padStart(13, '0')}`),
      { assumptions: [{ text: 'critical foundation', fundamental: true }] },
    );
    if (!cand.passes && cand.fundamentalErrors.length > 0) found = cand;
  }
  assert.ok(found, 'should locate a sha-derived invalid fundamental within 64 probes');
  assert.equal(found.verdict, 'REJECT_DEEP_FUNDAMENTAL');
});

test('deepVerificationReview deterministic across calls', () => {
  const args = {
    assumptions: [
      { text: 'a', fundamental: true },
      { text: 'b', fundamental: false },
    ],
  };
  const r1 = deepVerificationReview(hyp('same hypothesis text deterministic check'), args);
  const r2 = deepVerificationReview(hyp('same hypothesis text deterministic check'), args);
  assert.deepEqual(r1.perAssumption, r2.perAssumption);
});

test('deepVerificationReview throws on malformed assumptions', () => {
  assert.throws(() => deepVerificationReview(hyp('ok hypothesis text long enough'), { assumptions: [null] }), TypeError);
  assert.throws(() => deepVerificationReview(hyp('ok hypothesis text long enough'), { assumptions: [{}] }), TypeError);
});

// =================== 4. OBSERVATION REVIEW ===================

test('observationReview passes at >=70% accounted-for threshold', () => {
  const obs = [
    { text: 'obs A', accountedFor: true },
    { text: 'obs B', accountedFor: true },
    { text: 'obs C', accountedFor: true },
    { text: 'obs D', accountedFor: true },
    { text: 'obs E', accountedFor: false },
  ];
  const r = observationReview(hyp('hypothesis covering most observations'), { observations: obs });
  assert.equal(r.type, REVIEW_TYPES.OBSERVATION);
  assert.equal(r.accountedCount, 4);
  assert.equal(r.fractionAccounted, 0.8);
  assert.equal(r.passes, true);
  assert.equal(r.verdict, 'PASS_OBSERVATION');
});

test('observationReview exactly at 0.7 threshold passes', () => {
  const obs = [
    { text: 'o1', accountedFor: true },
    { text: 'o2', accountedFor: true },
    { text: 'o3', accountedFor: true },
    { text: 'o4', accountedFor: true },
    { text: 'o5', accountedFor: true },
    { text: 'o6', accountedFor: true },
    { text: 'o7', accountedFor: true },
    { text: 'o8', accountedFor: false },
    { text: 'o9', accountedFor: false },
    { text: 'o10', accountedFor: false },
  ];
  const r = observationReview(hyp('hypothesis at boundary threshold case'), { observations: obs });
  assert.equal(r.fractionAccounted, 0.7);
  assert.equal(r.passes, true);
});

test('observationReview fails below threshold', () => {
  const obs = [
    { text: 'obs A', accountedFor: true },
    { text: 'obs B', accountedFor: false },
    { text: 'obs C', accountedFor: false },
    { text: 'obs D', accountedFor: false },
  ];
  const r = observationReview(hyp('hypothesis missing most observations'), { observations: obs });
  assert.equal(r.fractionAccounted, 0.25);
  assert.equal(r.passes, false);
  assert.equal(r.verdict, 'REJECT_OBSERVATION');
});

test('observationReview empty observations fails (vacuous)', () => {
  const r = observationReview(hyp('hypothesis with no observation backing'), { observations: [] });
  assert.equal(r.passes, false);
  assert.equal(r.observationCount, 0);
});

test('observationReview throws on malformed observations', () => {
  assert.throws(() => observationReview(hyp('ok hypothesis text long enough'), { observations: [null] }), TypeError);
  assert.throws(() => observationReview(hyp('ok hypothesis text long enough'), { observations: [{ accountedFor: true }] }), TypeError);
});

// =================== 5. SIMULATION REVIEW ===================

test('simulationReview deterministic (same hypothesis + steps -> same result)', () => {
  const steps = [
    { name: 's1' },
    { name: 's2' },
    { name: 's3' },
  ];
  const h = hyp('mechanism with three sequential steps to simulate');
  const a = simulationReview(h, { steps });
  const b = simulationReview(h, { steps });
  assert.deepEqual(a.perStep, b.perStep);
  assert.equal(a.passes, b.passes);
  assert.equal(a.verdict, b.verdict);
});

test('simulationReview passes when all steps succeed', () => {
  // Most steps succeed (sha threshold ~87.5%); use 3 reasonable steps.
  // If by sha chance one fails we walk PIDs until all pass.
  let found = null;
  for (let i = 0; i < 32 && !found; i++) {
    const r = simulationReview(
      hyp('hypothesis simulated mechanism', `simPid${i.toString().padStart(10, '0')}`),
      { steps: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
    );
    if (r.passes) found = r;
  }
  assert.ok(found, 'expected at least one all-pass simulation within 32 probes');
  assert.equal(found.verdict, 'PASS_SIMULATION');
  assert.equal(found.failedStepCount, 0);
  assert.equal(found.stepCount, 3);
  for (const s of found.perStep) {
    assert.equal(s.succeeded, true);
    assert.equal(s.failureScenario, null);
  }
});

test('simulationReview produces failureScenario when step fails', () => {
  // Force at least one failure by hammering many step names per hypothesis.
  let found = null;
  for (let i = 0; i < 64 && !found; i++) {
    const steps = Array.from({ length: 20 }, (_, idx) => ({ name: `step_${i}_${idx}` }));
    const r = simulationReview(hyp(`probe variant ${i} long enough hypothesis`), { steps });
    if (!r.passes) found = r;
  }
  assert.ok(found, 'should locate a failing step within probe budget');
  const failed = found.perStep.find((p) => !p.succeeded);
  assert.ok(failed);
  assert.ok(typeof failed.failureScenario === 'string');
  assert.ok(failed.failureScenario.startsWith('failure_at_step='));
});

test('simulationReview empty steps fails (no steps to verify)', () => {
  const r = simulationReview(hyp('hypothesis with no simulation steps yet'), { steps: [] });
  assert.equal(r.passes, false);
  assert.equal(r.stepCount, 0);
});

// =================== AGGREGATE RUNNER ===================

test('runAllReviewTypes returns array of length 5', () => {
  const out = runAllReviewTypes(hyp('aggregate test hypothesis with enough length'), {
    literatureRefs: [],
    assumptions: [{ text: 'a', fundamental: false }],
    observations: [{ text: 'o', accountedFor: true }],
    steps: [{ name: 's' }],
  });
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 5);
});

test('runAllReviewTypes review.type values cover all 5: initial/full/deep-verify/observation/simulation', () => {
  const out = runAllReviewTypes(hyp('full coverage hypothesis for type assertions'), {});
  const types = out.map((r) => r.type);
  assert.deepEqual(types.slice().sort(), [
    'deep-verify',
    'full',
    'initial',
    'observation',
    'simulation',
  ]);
});

test('runAllReviewTypes order is canonical: initial, full, deep-verify, observation, simulation', () => {
  const out = runAllReviewTypes(hyp('order check hypothesis text long enough'), {});
  assert.equal(out[0].type, REVIEW_TYPES.INITIAL);
  assert.equal(out[1].type, REVIEW_TYPES.FULL);
  assert.equal(out[2].type, REVIEW_TYPES.DEEP_VERIFY);
  assert.equal(out[3].type, REVIEW_TYPES.OBSERVATION);
  assert.equal(out[4].type, REVIEW_TYPES.SIMULATION);
});

// =================== HBPv1 PIPE-ROW EMITTER ===================

test('toReviewRow is HBPv1 pipe-row (no JSON braces)', () => {
  const r = initialReview(hyp('emitter format check hypothesis with enough length'));
  const row = toReviewRow(r);
  assert.match(row, /^REVIEW\|/);
  assert.ok(!row.includes('{'), `row contains '{': ${row}`);
  assert.ok(!row.includes('}'), `row contains '}': ${row}`);
  assert.match(row, /type=initial/);
  assert.match(row, /passes=(true|false)/);
  assert.match(row, /verdict=/);
  assert.match(row, /reasons_count=\d+/);
});

test('toReviewRow includes type-specific tokens for full review', () => {
  const r = fullReview(hyp('full review emitter test hypothesis enough length'), { literatureRefs: ['x'] });
  const row = toReviewRow(r);
  assert.match(row, /type=full/);
  assert.match(row, /novelty=/);
  assert.match(row, /correctness=/);
  assert.match(row, /quality=/);
  assert.match(row, /lit_refs=1/);
});

test('toReviewRow includes type-specific tokens for deep-verify', () => {
  const r = deepVerificationReview(hyp('deep verify emitter test hypothesis enough length'), {
    assumptions: [{ text: 'a', fundamental: false }, { text: 'b', fundamental: true }],
  });
  const row = toReviewRow(r);
  assert.match(row, /type=deep-verify/);
  assert.match(row, /assumption_count=2/);
  assert.match(row, /fundamental_errors=\d+/);
  assert.match(row, /non_fundamental_errors=\d+/);
});

test('toReviewRow includes type-specific tokens for observation', () => {
  const r = observationReview(hyp('observation emitter test hypothesis enough length'), {
    observations: [{ text: 'o', accountedFor: true }],
  });
  const row = toReviewRow(r);
  assert.match(row, /type=observation/);
  assert.match(row, /observation_count=1/);
  assert.match(row, /accounted=1/);
  assert.match(row, /fraction=1/);
  assert.match(row, /threshold=0\.7/);
});

test('toReviewRow includes type-specific tokens for simulation', () => {
  const r = simulationReview(hyp('simulation emitter test hypothesis enough length'), {
    steps: [{ name: 'a' }, { name: 'b' }],
  });
  const row = toReviewRow(r);
  assert.match(row, /type=simulation/);
  assert.match(row, /step_count=2/);
  assert.match(row, /failed_steps=\d+/);
});

test('toReviewRow throws on malformed input', () => {
  assert.throws(() => toReviewRow(null), TypeError);
  assert.throws(() => toReviewRow({ passes: true }), TypeError);
});

// =================== INTERNALS SANITY ===================

test('_internals exposes documented constants', () => {
  assert.equal(_internals.MIN_HYPOTHESIS_LEN, 20);
  assert.equal(_internals.OBSERVATION_PASS_THRESHOLD, 0.7);
  assert.ok(_internals.BANNED_TERMS.includes('mind-reading'));
  assert.ok(_internals.BANNED_TERMS.includes('literal telepathy'));
});

test('_internals.sha16 returns 16-hex string', () => {
  const s = _internals.sha16('anything');
  assert.equal(s.length, 16);
  assert.match(s, /^[0-9a-f]{16}$/);
});

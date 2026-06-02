// Tests for meta-review feedback propagation module.
// Spec: arxiv:2502.18864 §3.3.6 (Google AI Co-Scientist Meta-review agent).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizePatternsFromReviews,
  summarizePatternsFromTournament,
  composeMetaCritique,
  generateResearchOverview,
  identifyResearchContacts,
  toMetaReviewRow,
} from '../src/meta-review-feedback.mjs';

// =================== summarizePatternsFromReviews ===================

test('summarizePatternsFromReviews: 10 reviews with shared term in reasoning -> term appears in recurringIssues', () => {
  // 10 negative-leaning reviews that all share the word "scalability" in their reasoning.
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    reviews.push({
      hypothesisPid: `hyp-${i}`,
      verdict: 'reject',
      reasoning: `Concern about scalability under heavy load — variation ${i}.`,
    });
  }
  const out = summarizePatternsFromReviews(reviews);
  assert.ok(out.recurringIssues.includes('scalability'),
    `expected "scalability" in recurringIssues, got ${JSON.stringify(out.recurringIssues)}`);
});

test('summarizePatternsFromReviews: empty array -> all empty', () => {
  const out = summarizePatternsFromReviews([]);
  assert.deepEqual(out, { recurringIssues: [], strengthSignals: [], blindSpots: [] });
});

test('summarizePatternsFromReviews: positive verdicts surface strengthSignals', () => {
  const reviews = [];
  for (let i = 0; i < 8; i++) {
    reviews.push({
      hypothesisPid: `hyp-${i}`,
      verdict: 'accept',
      reasoning: `Excellent novelty and rigorous methodology in attempt ${i}.`,
    });
  }
  const out = summarizePatternsFromReviews(reviews);
  assert.ok(out.strengthSignals.length > 0, 'expected strength signals from positive reviews');
  // "novelty" should be among the strengths.
  assert.ok(out.strengthSignals.includes('novelty') || out.strengthSignals.includes('methodology'),
    `expected positive terms, got ${JSON.stringify(out.strengthSignals)}`);
});

test('summarizePatternsFromReviews: caps at top 5 of each category', () => {
  // 10 reviews each containing 20 distinct repeated terms.
  const reviews = [];
  const terms = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
                 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon'];
  for (let i = 0; i < 10; i++) {
    reviews.push({
      hypothesisPid: `hyp-${i}`,
      verdict: 'reject',
      reasoning: terms.join(' '),
    });
  }
  const out = summarizePatternsFromReviews(reviews);
  assert.ok(out.recurringIssues.length <= 5, `expected ≤5, got ${out.recurringIssues.length}`);
});

// =================== summarizePatternsFromTournament ===================

test('summarizePatternsFromTournament: matchHistory with common loss-reason -> appears in commonLossPatterns', () => {
  // 10 matches where loser always lost due to "insufficient evidence".
  const matchHistory = [];
  for (let i = 0; i < 10; i++) {
    matchHistory.push({
      matchId: `m-${i}`,
      winnerPid: `w-${i}`,
      loserPid: `l-${i}`,
      winReason: `Stronger empirical backing on round ${i}.`,
      lossReason: `Insufficient evidence supporting central claim — case ${i}.`,
    });
  }
  const out = summarizePatternsFromTournament(matchHistory);
  assert.ok(out.commonLossPatterns.includes('insufficient') || out.commonLossPatterns.includes('evidence'),
    `expected loss term, got ${JSON.stringify(out.commonLossPatterns)}`);
});

test('summarizePatternsFromTournament: empty -> both empty', () => {
  const out = summarizePatternsFromTournament([]);
  assert.deepEqual(out, { dominantStrategies: [], commonLossPatterns: [] });
});

test('summarizePatternsFromTournament: dominantStrategies surfaces recurring win terms', () => {
  const matchHistory = [];
  for (let i = 0; i < 8; i++) {
    matchHistory.push({
      matchId: `m-${i}`,
      winnerPid: `w-${i}`,
      loserPid: `l-${i}`,
      winReason: `Mechanistic clarity dominated debate in round ${i}.`,
      lossReason: `weak`,
    });
  }
  const out = summarizePatternsFromTournament(matchHistory);
  assert.ok(out.dominantStrategies.includes('mechanistic') || out.dominantStrategies.includes('clarity'),
    `expected dominant win term, got ${JSON.stringify(out.dominantStrategies)}`);
});

// =================== composeMetaCritique ===================

test('composeMetaCritique: output starts with "META-REVIEW iter=" and is ≤500 chars', () => {
  const out = composeMetaCritique({
    reviewPatterns: {
      recurringIssues: ['scalability', 'reproducibility'],
      strengthSignals: ['novelty'],
      blindSpots: ['ethics'],
    },
    tournamentPatterns: {
      dominantStrategies: ['mechanistic'],
      commonLossPatterns: ['weak-evidence'],
    },
    iteration: 7,
  });
  assert.ok(out.startsWith('META-REVIEW iter=7 FEEDBACK:'),
    `expected prefix, got "${out.slice(0, 60)}…"`);
  assert.ok(out.length <= 500, `length ${out.length} exceeds 500`);
});

test('composeMetaCritique: returns different output for different iterations (and same for same)', () => {
  const inputs = {
    reviewPatterns: { recurringIssues: ['x'], strengthSignals: [], blindSpots: [] },
    tournamentPatterns: { dominantStrategies: [], commonLossPatterns: [] },
  };
  const a = composeMetaCritique({ ...inputs, iteration: 1 });
  const b = composeMetaCritique({ ...inputs, iteration: 2 });
  const aAgain = composeMetaCritique({ ...inputs, iteration: 1 });
  assert.notEqual(a, b, 'different iterations should yield different output');
  assert.equal(a, aAgain, 'same iteration + same inputs should be deterministic');
});

test('composeMetaCritique: empty patterns yields exploratory fallback', () => {
  const out = composeMetaCritique({
    reviewPatterns: { recurringIssues: [], strengthSignals: [], blindSpots: [] },
    tournamentPatterns: { dominantStrategies: [], commonLossPatterns: [] },
    iteration: 0,
  });
  assert.ok(out.startsWith('META-REVIEW iter=0 FEEDBACK:'));
  assert.match(out, /no recurring patterns detected/);
});

test('composeMetaCritique: truncates oversized inputs to ≤500 chars', () => {
  const huge = Array.from({ length: 50 }, (_, i) => `terminology_${i}_with_padding`);
  const out = composeMetaCritique({
    reviewPatterns: { recurringIssues: huge, strengthSignals: huge, blindSpots: huge },
    tournamentPatterns: { dominantStrategies: huge, commonLossPatterns: huge },
    iteration: 99,
  });
  assert.ok(out.length <= 500, `length ${out.length} exceeds 500`);
  assert.ok(out.startsWith('META-REVIEW iter=99 FEEDBACK:'));
});

// =================== generateResearchOverview ===================

test('generateResearchOverview format=hbpv1: output is pipe-row', () => {
  const out = generateResearchOverview({
    topHypotheses: [
      { pid: 'h1', title: 'Hypothesis A', summary: 'sum-a', eloScore: 1500 },
      { pid: 'h2', title: 'Hypothesis B', summary: 'sum-b', eloScore: 1450 },
    ],
    researchGoal: 'cure aging',
    format: 'hbpv1',
  });
  assert.ok(out.includes('RESEARCH-OVERVIEW|'), 'expected RESEARCH-OVERVIEW header row');
  assert.ok(out.includes('HYP-RANK|'), 'expected HYP-RANK rows');
  // No JSON braces in HBPv1 output.
  assert.ok(!out.includes('{'), 'HBPv1 output must not contain JSON braces');
  assert.ok(!out.includes('}'), 'HBPv1 output must not contain JSON braces');
  // Pipe-row shape on every line.
  for (const line of out.split('\n')) {
    assert.ok(line.includes('|'), `line missing pipe-row shape: "${line}"`);
  }
});

test('generateResearchOverview format=hbpv1 is default', () => {
  const out = generateResearchOverview({
    topHypotheses: [{ pid: 'h1', title: 'A', summary: 's' }],
    researchGoal: 'goal',
  });
  assert.ok(out.includes('RESEARCH-OVERVIEW|'));
});

test('generateResearchOverview format=nih-aims: contains "Specific Aim 1" / 2 / 3 section markers', () => {
  const out = generateResearchOverview({
    topHypotheses: [
      { pid: 'h1', title: 'Hyp A', summary: 'sum-a' },
      { pid: 'h2', title: 'Hyp B', summary: 'sum-b' },
      { pid: 'h3', title: 'Hyp C', summary: 'sum-c' },
    ],
    researchGoal: 'cure cancer',
    format: 'nih-aims',
  });
  assert.match(out, /Specific Aim 1/);
  assert.match(out, /Specific Aim 2/);
  assert.match(out, /Specific Aim 3/);
  assert.match(out, /Research Goal:/);
});

test('generateResearchOverview format=nih-aims: pads to 3 aims even with fewer hypotheses', () => {
  const out = generateResearchOverview({
    topHypotheses: [{ pid: 'h1', title: 'only one' }],
    researchGoal: 'goal',
    format: 'nih-aims',
  });
  assert.match(out, /Specific Aim 1/);
  assert.match(out, /Specific Aim 2/);
  assert.match(out, /Specific Aim 3/);
});

// =================== identifyResearchContacts ===================

test('identifyResearchContacts: with literatureRefs returns suggested experts', () => {
  const out = identifyResearchContacts({
    topHypotheses: [{ pid: 'h1', title: 'cell aging' }],
    literatureRefs: [
      { title: 'Telomere dynamics', authors: [{ name: 'Jane Smith', affiliation: 'Stanford' }] },
      { title: 'Senescence pathways', authors: [{ name: 'John Doe', affiliation: 'MIT' }, { name: 'Jane Smith', affiliation: 'Stanford' }] },
    ],
  });
  assert.ok(Array.isArray(out));
  assert.ok(out.length >= 2, `expected ≥2 contacts, got ${out.length}`);
  const names = out.map(c => c.expertName);
  assert.ok(names.includes('Jane Smith'));
  assert.ok(names.includes('John Doe'));
  // Each contact must have name/affiliation/rationale.
  for (const c of out) {
    assert.ok(c.expertName, 'expertName required');
    assert.ok(c.affiliation, 'affiliation required');
    assert.ok(c.rationale, 'rationale required');
  }
  // Most prolific author (Jane Smith — 2 refs) should sort first.
  assert.equal(out[0].expertName, 'Jane Smith');
});

test('identifyResearchContacts: without literatureRefs returns empty + note', () => {
  const out = identifyResearchContacts({ topHypotheses: [{ pid: 'h1' }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].note, 'NO_LITERATURE_REFS_PROVIDED');
  assert.equal(out[0].expertName, null);
});

test('identifyResearchContacts: literatureRefs = [] returns the same sentinel', () => {
  const out = identifyResearchContacts({ topHypotheses: [], literatureRefs: [] });
  assert.equal(out.length, 1);
  assert.equal(out[0].note, 'NO_LITERATURE_REFS_PROVIDED');
});

// =================== toMetaReviewRow ===================

test('toMetaReviewRow is HBPv1 pipe-row (no JSON braces)', () => {
  const critique = composeMetaCritique({
    reviewPatterns: {
      recurringIssues: ['scalability', 'reproducibility'],
      strengthSignals: ['novelty'],
      blindSpots: ['ethics'],
    },
    tournamentPatterns: {
      dominantStrategies: ['mechanistic'],
      commonLossPatterns: ['weak-evidence'],
    },
    iteration: 3,
  });
  const row = toMetaReviewRow(critique, 3);
  assert.match(row, /^META-REVIEW\|/);
  assert.ok(!row.includes('{'), 'no JSON brace');
  assert.ok(!row.includes('}'), 'no JSON brace');
  assert.match(row, /iter=3/);
  assert.match(row, /sha16=[0-9a-f]{16}/);
  assert.match(row, /recurring=2/);
  assert.match(row, /strengths=1/);
  assert.match(row, /blindspots=1/);
});

test('toMetaReviewRow deterministic for same critique+iteration', () => {
  const critique = 'META-REVIEW iter=5 FEEDBACK: recurring issues: a, b.';
  const a = toMetaReviewRow(critique, 5);
  const b = toMetaReviewRow(critique, 5);
  assert.equal(a, b);
});

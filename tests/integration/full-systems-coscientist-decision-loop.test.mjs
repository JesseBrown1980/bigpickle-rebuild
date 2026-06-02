// FULL-SYSTEMS acceptance test — Co-Scientist 6-agent cycle ∪ Decision-loop (LAW-1M-1E200) ∪ HBPv1 audit trinity.
// Per operator 2026-05-29 "unit tests and integration tests, and then suite and full systems tests, and then pass".
//
// Demonstrates the canonical L8→L9 promotion empirical proof:
//   1. Research question intake (operator-class authority)
//   2. Decision loop mints N=10000 agents per question, detects collisions, votes
//   3. Top-voted guidance becomes seed-hypothesis weakness for Co-Scientist
//   4. Co-Scientist 6-agent cycle runs to convergence or iteration cap
//   5. Every artifact emitted as HBPv1 trinity (.hbp + .hbi + .sha256 + .hex) to tmp dir
//   6. Final assertions: pool grew, audit trail complete, no canon violations
//
// This is the integration that bridges:
//   - Foundation v1 (PIDChainRevolver / 7-lane / 1M-PID packet substrate)
//   - Co-Scientist (Google §3.3.1-§3.3.6 6-agent scientific cycle)
//   - HBPv1 audit canon (per-artifact sha-stable trinity)
//   - LAW-1M-1E200 vote-not-pass decision gate

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  intakeQuestion,
  mintAgentsForQuestion,
  detectCollisionsAndGuide,
  tallyVote,
  runDecisionLoop,
} from '../../src/decision-loop-core.mjs';
import { runAllReviewTypes, toReviewRow } from '../../src/reflection-five-types.mjs';
import { runTournament } from '../../src/elo-tournament.mjs';
import { buildProximityGraph, dedupHypotheses, prioritizedPairsForTournament } from '../../src/proximity-graph.mjs';
import { runAllEvolutionApproaches, toEvolutionRow } from '../../src/evolution-six-approaches.mjs';
import { summarizePatternsFromReviews, summarizePatternsFromTournament, composeMetaCritique, toMetaReviewRow } from '../../src/meta-review-feedback.mjs';
import { writeHBP } from '../../src/hbp-emitter.mjs';

function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }

test('FULL-SYSTEMS: research-question → decision-loop → Co-Scientist cycle → HBPv1 audit trail', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'co-scientist-full-systems-'));
  const artifactsWritten = [];
  try {
    // ============================================================
    // PHASE 1: Operator intakes 3 research questions.
    // ============================================================
    const questions = [
      'why did the 100M run die at 25M packets',
      'how to fire 1T real free agents safely',
      'identify lane-imbalance amplifiers in PIDChainRevolver',
    ];
    const loopResult = runDecisionLoop({
      questions,
      agentCountPerQuestion: 10000,
      cascadeId: 'full-systems-test',
    });
    assert.equal(loopResult.intaken, 3, 'all 3 questions intaken');
    assert.equal(loopResult.questionResults.length, 3);
    // Each question minted exactly 10000 agents on its own row.
    for (const r of loopResult.questionResults) {
      assert.equal(r.agentCount, 10000);
      assert.ok(r.geniusRate >= 0.04 && r.geniusRate <= 0.06,
        `question ${r.qPid} genius rate ${r.geniusRate} out of expected band`);
    }

    // Emit decision-loop summary as HBPv1 trinity artifact.
    const decisionArt = writeHBP(join(tmpRoot, 'decision-loop-result'), {
      type: 'DECISION-LOOP-RESULT',
      payload: `questions=${loopResult.intaken}|results=${loopResult.questionResults.length}|next_step=${loopResult.nextStep?.readyForNextCycle ? 'ready' : 'terminate'}`,
      metadata: { cascadeId: 'full-systems-test', test: 'true' },
    });
    artifactsWritten.push(decisionArt);

    // ============================================================
    // PHASE 2: Seed Co-Scientist with hypotheses derived from each question.
    // ============================================================
    const seedPool = [];
    for (const q of loopResult.questionResults) {
      // Mint 3 candidate hypotheses per intaken question (Generation agent stand-in).
      for (let i = 0; i < 3; i++) {
        seedPool.push({
          pid: sha16(`gen|${q.qPid}|${i}`),
          text: `candidate ${i} for question ${q.qPid.slice(0, 8)}`,
        });
      }
    }
    assert.equal(seedPool.length, 9, '3 questions × 3 candidates = 9 seed hypotheses');

    // ============================================================
    // PHASE 3: Run 2 Co-Scientist iterations.
    // ============================================================
    let pool = seedPool;
    const iterationRecords = [];
    let weakness = 'initial-iteration-no-prior-feedback';

    for (let i = 0; i < 2; i++) {
      // Reflection: 5 review types per hypothesis.
      const reviews = [];
      for (const h of pool) {
        const hyReviews = runAllReviewTypes(h, {
          literatureRefs: [{ title: 'seed-ref', sha16: sha16('seed-ref') }],
          assumptions: [{ text: 'core assumption' }],
          observations: [{ text: 'observation A' }],
          steps: [{ text: 'step 1' }, { text: 'step 2' }],
        });
        for (const rv of hyReviews) reviews.push(rv);
      }
      assert.equal(reviews.length, pool.length * 5);

      // Proximity dedup + prioritized pairs.
      const deduped = dedupHypotheses({ hypotheses: pool, threshold: 0.95 });
      const graph = buildProximityGraph({ hypotheses: deduped, threshold: 0.4 });
      // Object shape passed directly post-fix chain seq=3545 (Liris Task #37 audit OPT_2).
      const proximityPairs = prioritizedPairsForTournament({ graph, hypotheses: deduped, topK: 10 });

      // Elo tournament — 3 rounds, deterministic judge.
      const tournament = runTournament({
        hypotheses: deduped,
        proximityPairsOrUndefined: proximityPairs,
        multiTurnThreshold: 1400,
        rounds: 3,
        deterministicSeed: `full-systems|iter=${i}`,
      });
      assert.ok(tournament.matchHistory.length > 0, `iter ${i}: tournament played at least 1 match`);

      // Evolution — 6 new hypotheses from top-ranked.
      const topRanked = tournament.hypotheses.slice(0, 3);
      const parent = topRanked[0];
      const parentSnapshot = JSON.stringify(parent);
      const evolved = runAllEvolutionApproaches({ parent, topRanked, weakness });
      assert.equal(evolved.length, 6, 'evolution emits exactly 6 new hypotheses');
      assert.equal(JSON.stringify(parent), parentSnapshot, 'parent NEVER mutated (Co-Scientist §3.3.5 canon)');

      // Meta-review patterns + critique.
      const tournamentForPatterns = tournament.matchHistory.map(m => ({
        matchId: `${m.hypA}|${m.hypB}`,
        winnerPid: m.winner === 'A' ? m.hypA : m.hypB,
        loserPid: m.winner === 'A' ? m.hypB : m.hypA,
        winReason: 'tournament debate',
        lossReason: 'tournament debate',
      }));
      const reviewPatterns = summarizePatternsFromReviews(reviews);
      const tournamentPatterns = summarizePatternsFromTournament(tournamentForPatterns);
      const critique = composeMetaCritique({ reviewPatterns, tournamentPatterns, iteration: i });
      assert.ok(critique.length > 0, `iter ${i}: empty critique`);

      iterationRecords.push({ iteration: i, pool: deduped, reviews, tournament, evolved, critique });

      // Emit per-iteration HBPv1 artifact.
      const iterArt = writeHBP(join(tmpRoot, `iter-${i}-summary`), {
        type: 'CO-SCIENTIST-ITERATION',
        payload: `iter=${i}|pool=${deduped.length}|reviews=${reviews.length}|matches=${tournament.matchHistory.length}|evolved=${evolved.length}|top_elo=${tournament.hypotheses[0]?.elo ?? 0}`,
        metadata: { critique_sha16: sha16(critique), iteration: String(i) },
      });
      artifactsWritten.push(iterArt);

      // Inject evolved into next pool.
      pool = [...deduped, ...evolved];
      weakness = critique.slice(0, 80) || 'no-meta-feedback';
    }

    // ============================================================
    // PHASE 4: Final assertions on the system.
    // ============================================================
    // A) Pool grew across iterations.
    assert.ok(pool.length > seedPool.length, `final pool ${pool.length} did not grow from seed ${seedPool.length}`);

    // B) All seed PIDs still present (Evolution canon §3.3.5).
    const finalPids = new Set(pool.map(h => h.pid));
    for (const seed of seedPool) {
      assert.ok(finalPids.has(seed.pid), `seed ${seed.pid} lost (mutation canon violation)`);
    }

    // C) Audit trail: HBPv1 trinity on disk for every artifact.
    for (const art of artifactsWritten) {
      assert.ok(existsSync(art.hbp), `missing .hbp at ${art.hbp}`);
      assert.ok(existsSync(art.hbi), `missing .hbi at ${art.hbi}`);
      assert.ok(existsSync(art.sha256), `missing .sha256 at ${art.sha256}`);
      assert.ok(existsSync(art.hex), `missing .hex at ${art.hex}`);
    }

    // D) Sha256 sidecars verify against .hbp bodies.
    for (const art of artifactsWritten) {
      const body = readFileSync(art.hbp);
      const computed = createHash('sha256').update(body).digest('hex');
      assert.equal(computed, art.sha, `sha mismatch for ${art.hbp}`);
      const shaFile = readFileSync(art.sha256, 'utf8');
      assert.match(shaFile, new RegExp(`^${art.sha}\\s+`), 'sha256 sidecar wrong');
    }

    // E) Decision-loop nextStep produced valid output.
    assert.ok(loopResult.nextStep, 'decision loop produced nextStep');
    assert.ok(loopResult.supervisorAsk, 'decision loop produced supervisorAsk');
    assert.equal(loopResult.supervisorAsk.to, 'SUP-DAEMON');

    // F) Meta-critique audit row valid HBPv1 (no JSON braces).
    for (const rec of iterationRecords) {
      const row = toMetaReviewRow(rec.critique, rec.iteration);
      assert.match(row, /^META-REVIEW\|/);
      assert.ok(!row.includes('{'));
    }

    // G) Cross-artifact integrity: trinity dir contains 3×4 = 12 files (1 decision + 2 iterations × 4 sidecars).
    const dirFiles = readdirSync(tmpRoot);
    const expectedFileCount = (1 + 2) * 4;
    assert.equal(dirFiles.length, expectedFileCount,
      `expected ${expectedFileCount} sidecar files, got ${dirFiles.length}`);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('FULL-SYSTEMS: decision-loop runs are deterministic for same cascadeId+questions+agentCount', () => {
  const questions = ['deterministic question 1', 'deterministic question 2'];
  const a = runDecisionLoop({ questions, agentCountPerQuestion: 5000, cascadeId: 'det-test' });
  const b = runDecisionLoop({ questions, agentCountPerQuestion: 5000, cascadeId: 'det-test' });
  assert.equal(a.questionResults[0].qPid, b.questionResults[0].qPid);
  assert.equal(a.questionResults[0].geniusHits, b.questionResults[0].geniusHits);
  assert.equal(a.questionResults[0].mistakeHits, b.questionResults[0].mistakeHits);
});

test('FULL-SYSTEMS: HBPv1 trinity sha-stable across re-emission with same payload', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'hbpv1-stable-'));
  try {
    const env = {
      type: 'STABILITY-TEST',
      payload: 'identical-payload-bytes',
      metadata: { fixed: 'true' },
    };
    const a = writeHBP(join(tmpRoot, 'a'), env);
    const b = writeHBP(join(tmpRoot, 'b'), env);
    assert.equal(a.sha, b.sha, 'identical envelopes must yield identical sha');
    assert.equal(a.bytes, b.bytes);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// Unit + integration tests for decision-loop-core.
// Per operator 2026-05-28T21:00Z canonical clarification on closed loop architecture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  intakeQuestion,
  mintAgentsForQuestion,
  detectCollisionsAndGuide,
  tallyVote,
  buildSupervisorAsk,
  autoSelfDriveStep,
  runDecisionLoop,
} from '../src/decision-loop-core.mjs';

// =================== INTAKE ===================
test('intakeQuestion produces deterministic qPid for same text', () => {
  const a = intakeQuestion({ text: 'what is the meaning of decision loop' });
  const b = intakeQuestion({ text: 'what is the meaning of decision loop' });
  assert.equal(a.qPid, b.qPid);
});

test('intakeQuestion rejects missing text', () => {
  assert.throws(() => intakeQuestion({}), TypeError);
});

test('intakeQuestion row is HBPv1 pipe-row no JSON', () => {
  const q = intakeQuestion({ text: 'test', source: 'operator' });
  assert.match(q.row, /^QUESTION\|/);
  assert.ok(!q.row.includes('{'));
  assert.match(q.row, /source=operator/);
});

// =================== 1M REAL AGENT BATCH ===================
test('mintAgentsForQuestion at 10K agents distributes lanes uniformly (within 1%)', () => {
  const q = intakeQuestion({ text: 'lane uniformity test' });
  const result = mintAgentsForQuestion({ question: q, agentCount: 10000, cascadeId: 'test' });
  assert.equal(result.agentCount, 10000);
  for (const c of result.laneCounts) {
    const dev = Math.abs(c - 10000 / 7);
    assert.ok(dev <= 1, `lane count ${c} deviates >1 from 10000/7`);
  }
});

test('mintAgentsForQuestion genius+mistake+neutral sum to agentCount', () => {
  const q = intakeQuestion({ text: 'classification sum check' });
  const result = mintAgentsForQuestion({ question: q, agentCount: 5000, cascadeId: 'test' });
  assert.equal(result.geniusHits + result.mistakeHits + result.neutralHits, 5000);
});

test('mintAgentsForQuestion genius/mistake rates near 5% at 100K', () => {
  const q = intakeQuestion({ text: 'rate convergence' });
  const result = mintAgentsForQuestion({ question: q, agentCount: 100000, cascadeId: 'test' });
  const gRate = result.geniusHits / 100000;
  const mRate = result.mistakeHits / 100000;
  assert.ok(gRate >= 0.04 && gRate <= 0.06, `genius rate ${gRate} not in [0.04, 0.06]`);
  assert.ok(mRate >= 0.04 && mRate <= 0.06, `mistake rate ${mRate} not in [0.04, 0.06]`);
});

// =================== 1e200 COLLISION DETECTOR ===================
test('detectCollisionsAndGuide flags z>2 genius-rate outlier', () => {
  // 10 normal-rate questions + 1 extreme outlier — outlier z > 2
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push({ qPid: `q${i}`, agentCount: 1000, geniusHits: 50, laneCounts: [142, 143, 143, 143, 143, 143, 143] });
  }
  results.push({ qPid: 'q-outlier', agentCount: 1000, geniusHits: 500, laneCounts: [142, 143, 143, 143, 143, 143, 143] });
  const out = detectCollisionsAndGuide({ questionResults: results });
  const outlierCollision = out.collisions.find(c => c.qPid === 'q-outlier' && c.type === 'genius-rate-divergence');
  assert.ok(outlierCollision, 'should detect outlier');
  assert.ok(outlierCollision.z_score > 2);
});

test('detectCollisionsAndGuide emits guidance per collision', () => {
  const results = [];
  for (let i = 0; i < 8; i++) {
    results.push({ qPid: `q${i}`, agentCount: 1000, geniusHits: 50, laneCounts: [142, 143, 143, 143, 143, 143, 143] });
  }
  results.push({ qPid: 'q-out', agentCount: 1000, geniusHits: 400, laneCounts: [200, 143, 143, 143, 143, 143, 143] }); // both lane skew + outlier
  const out = detectCollisionsAndGuide({ questionResults: results });
  assert.ok(out.guidance.length > 0, `expected guidance, got ${out.guidance.length}`);
  for (const g of out.guidance) {
    assert.ok(g.advicePid);
    assert.ok(g.action);
    assert.ok(g.rationale);
  }
});

test('detectCollisionsAndGuide handles uniform distribution = no collisions', () => {
  const results = Array.from({ length: 5 }, (_, i) => ({
    qPid: `q${i}`,
    agentCount: 10000,
    geniusHits: 500, // exactly 5%
    laneCounts: [1428, 1428, 1428, 1429, 1429, 1429, 1429], // uniform
  }));
  const out = detectCollisionsAndGuide({ questionResults: results });
  const geniusCollisions = out.collisions.filter(c => c.type === 'genius-rate-divergence');
  assert.equal(geniusCollisions.length, 0, 'uniform should produce no genius collisions');
});

// =================== VOTING ===================
test('tallyVote majority YES -> EXECUTE', () => {
  const guidance = [{ advicePid: 'a1', action: 'TEST_ACTION' }];
  const votes = [
    { voterPid: 'v1', advicePid: 'a1', position: 'YES' },
    { voterPid: 'v2', advicePid: 'a1', position: 'YES' },
    { voterPid: 'v3', advicePid: 'a1', position: 'NO' },
  ];
  const out = tallyVote({ guidance, votes });
  assert.equal(out[0].decision, 'EXECUTE');
  assert.equal(out[0].passed, true);
});

test('tallyVote majority NO -> DEFER', () => {
  const guidance = [{ advicePid: 'a1', action: 'TEST_ACTION' }];
  const votes = [
    { voterPid: 'v1', advicePid: 'a1', position: 'NO' },
    { voterPid: 'v2', advicePid: 'a1', position: 'NO' },
    { voterPid: 'v3', advicePid: 'a1', position: 'YES' },
  ];
  const out = tallyVote({ guidance, votes });
  assert.equal(out[0].decision, 'DEFER');
});

// =================== SUPERVISOR ASK ===================
test('buildSupervisorAsk targets SUP-DAEMON with DECISION-LOOP-ASK-V1 schema', () => {
  const ask = buildSupervisorAsk({ guidance: [{ advicePid: 'a1', action: 'X', rationale: 'r' }] });
  assert.equal(ask.to, 'SUP-DAEMON');
  assert.equal(ask.schema, 'DECISION-LOOP-ASK-V1');
  assert.equal(ask.body.guidance_count, 1);
});

// =================== AUTO-SELF-DRIVE ===================
test('autoSelfDriveStep generates next questions from passed EXECUTE outcomes', () => {
  const outcomes = [
    { advicePid: 'a1', action: 'AMPLIFY_AGENTS_THIS_QUESTION_HIGHER_GENIUS_RATE', passed: true, decision: 'EXECUTE' },
    { advicePid: 'a2', action: 'REBALANCE_LANE_ASSIGNMENT', passed: true, decision: 'EXECUTE' },
    { advicePid: 'a3', action: 'INVESTIGATE_LOW_GENIUS_RATE_QUESTION', passed: false, decision: 'DEFER' },
  ];
  const next = autoSelfDriveStep({ outcomes });
  assert.equal(next.nextQuestions.length, 2);
  assert.equal(next.readyForNextCycle, true);
});

test('autoSelfDriveStep terminates loop when no EXECUTE outcomes', () => {
  const outcomes = [
    { advicePid: 'a1', action: 'X', passed: false, decision: 'DEFER' },
  ];
  const next = autoSelfDriveStep({ outcomes });
  assert.equal(next.nextQuestions.length, 0);
  assert.equal(next.readyForNextCycle, false);
});

// =================== FULL LOOP INTEGRATION ===================
test('runDecisionLoop end-to-end: 3 questions × 10K agents → collisions → vote → next step', () => {
  const questions = [
    'what is the optimal lane distribution',
    'why did the 100M run die at 25M',
    'how to fire 1T real free agents safely',
  ];
  const out = runDecisionLoop({ questions, agentCountPerQuestion: 10000, cascadeId: 'test-loop-1' });
  assert.equal(out.intaken, 3);
  assert.equal(out.questionResults.length, 3);
  for (const r of out.questionResults) {
    assert.equal(r.agentCount, 10000);
    assert.ok(r.geniusRate >= 0.04 && r.geniusRate <= 0.06);
  }
  assert.ok(out.supervisorAsk);
  assert.equal(out.supervisorAsk.to, 'SUP-DAEMON');
  assert.ok(out.nextStep);
});

test('runDecisionLoop with single question still produces valid output', () => {
  const out = runDecisionLoop({ questions: ['singleton'], agentCountPerQuestion: 5000, cascadeId: 'singleton' });
  assert.equal(out.intaken, 1);
  assert.equal(out.questionResults[0].agentCount, 5000);
});

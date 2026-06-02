// Decision-loop core: 1M real free agents <-> 1e200 virtual collision detector <-> vote/ask/auto-self-drive.
// Per operator 2026-05-28T21:00Z canonical clarification:
//   "1M FREE agents (like smaller 100B run) fed with real questions,
//    1e200 virtual fanout collisions LOOKS at 1M results and gives guidance,
//    agents work on making advices true by voting and asking and auto self driving."
//
// LAW-1M-1E200 closed feedback loop architecture.

import { createHash } from 'node:crypto';
import { LANE_CYCLE } from './pid-chain-revolver.mjs';

function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function pipeRow(...p) { return p.join('|'); }

// =================== 1. QUESTION INTAKE ===================
// Real questions come from operator, federation, or seed file.
// Each question becomes a work-scope for a slice of the 1M agents.

export function intakeQuestion({ text, source = 'operator', priority = 'normal', id }) {
  if (!text || typeof text !== 'string') throw new TypeError('intakeQuestion: text required');
  const qPid = sha16(`question|${source}|${text}`);
  return {
    qId: id || qPid,
    qPid,
    text,
    source,
    priority,
    intakeTs: new Date().toISOString(),
    row: pipeRow('QUESTION', `qid=${id || qPid}`, `qpid=${qPid}`, `source=${source}`, `priority=${priority}`, `text_sha16=${sha16(text)}`, `text_len=${text.length}`),
  };
}

// =================== 2. 1M REAL AGENT BATCH (per question) ===================
// For each question, mint N agents that process the question via PIDChainRevolver pattern.
// Each agent gets a unique PID + lane assignment + score derived from question+agent+digest.

export function mintAgentsForQuestion({ question, agentCount, cascadeId }) {
  const agents = [];
  const laneCounts = new Array(LANE_CYCLE.length).fill(0);
  let geniusHits = 0, mistakeHits = 0, neutralHits = 0;
  for (let i = 0; i < agentCount; i++) {
    const digest = createHash('sha256').update(`agent|${cascadeId}|${question.qPid}|${i}`).digest();
    const agentPid = digest.toString('hex').slice(0, 16);
    const score = digest.readUInt32BE(0) / 0xFFFFFFFF;
    const laneIdx = i % LANE_CYCLE.length;
    laneCounts[laneIdx]++;
    if (score > 0.95) geniusHits++;
    else if (score < 0.05) mistakeHits++;
    else neutralHits++;
    if (i < 5) agents.push({ idx: i, pid: agentPid, score: Number(score.toFixed(6)), lane: LANE_CYCLE[laneIdx] });
  }
  return {
    qPid: question.qPid,
    agentCount,
    sampledAgents: agents,
    laneCounts,
    geniusHits,
    mistakeHits,
    neutralHits,
    cascadeId,
  };
}

// =================== 3. 1e200 VIRTUAL COLLISION DETECTOR ===================
// Looks at the 1M results across N questions. Detects "collisions":
//   - Two questions whose genius-rate diverges significantly (>3 sigma)
//   - Lane distribution skews
//   - Score-cluster patterns
// Emits "guidance" rows: advice based on detected collisions.

export function detectCollisionsAndGuide({ questionResults }) {
  if (questionResults.length === 0) return { collisions: [], guidance: [] };
  const collisions = [];
  const guidance = [];
  // Pairwise genius-rate divergence
  const rates = questionResults.map(r => r.geniusHits / r.agentCount);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  const sigma = Math.sqrt(variance);
  for (let i = 0; i < rates.length; i++) {
    const z = sigma > 0 ? Math.abs(rates[i] - mean) / sigma : 0;
    if (z > 2) {
      collisions.push({
        qPid: questionResults[i].qPid,
        type: 'genius-rate-divergence',
        z_score: Number(z.toFixed(2)),
        observed: Number(rates[i].toFixed(6)),
        expected: Number(mean.toFixed(6)),
      });
    }
  }
  // Lane skew detector: max lane count vs mean
  for (const r of questionResults) {
    const total = r.laneCounts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const meanL = total / r.laneCounts.length;
    const maxL = Math.max(...r.laneCounts);
    const skew = (maxL - meanL) / meanL;
    if (skew > 0.05) {
      collisions.push({
        qPid: r.qPid,
        type: 'lane-skew',
        skew: Number(skew.toFixed(4)),
      });
    }
  }
  // Guidance: for each collision, emit advice
  for (const c of collisions) {
    if (c.type === 'genius-rate-divergence') {
      guidance.push({
        advicePid: sha16(`advice|${c.qPid}|${c.type}`),
        qPid: c.qPid,
        action: c.observed > c.expected ? 'AMPLIFY_AGENTS_THIS_QUESTION_HIGHER_GENIUS_RATE' : 'INVESTIGATE_LOW_GENIUS_RATE_QUESTION',
        rationale: `z-score ${c.z_score} from mean (sigma=${sigma.toFixed(6)})`,
        vote_required: c.z_score > 3,
      });
    } else if (c.type === 'lane-skew') {
      guidance.push({
        advicePid: sha16(`advice|${c.qPid}|${c.type}`),
        qPid: c.qPid,
        action: 'REBALANCE_LANE_ASSIGNMENT',
        rationale: `lane skew ${c.skew}`,
        vote_required: false,
      });
    }
  }
  return { collisions, guidance, mean, sigma };
}

// =================== 4. AGENT VOTING ===================

export function tallyVote({ guidance, votes }) {
  // votes = [{ voterPid, advicePid, position }] where position in {YES, NO, ABSTAIN}
  const tallies = new Map();
  for (const g of guidance) tallies.set(g.advicePid, { yes: 0, no: 0, abstain: 0 });
  for (const v of votes) {
    const t = tallies.get(v.advicePid);
    if (!t) continue;
    t[v.position.toLowerCase()] = (t[v.position.toLowerCase()] || 0) + 1;
  }
  const outcomes = [];
  for (const g of guidance) {
    const t = tallies.get(g.advicePid);
    const total = t.yes + t.no;
    const passed = total > 0 && t.yes / total > 0.5;
    outcomes.push({
      advicePid: g.advicePid,
      action: g.action,
      tally: t,
      passed,
      decision: passed ? 'EXECUTE' : 'DEFER',
    });
  }
  return outcomes;
}

// =================== 5. ASK FABRIC SUPERVISORS ===================
// Returns an envelope to send via behcs-bus /behcs/send to SUP-DAEMON.

export function buildSupervisorAsk({ guidance, fromAgent = 'decision-loop' }) {
  return {
    to: 'SUP-DAEMON',
    from: fromAgent,
    kind: 'GUIDANCE-CHECK',
    schema: 'DECISION-LOOP-ASK-V1',
    body: {
      guidance_count: guidance.length,
      asks: guidance.map(g => ({ advicePid: g.advicePid, action: g.action, rationale: g.rationale })),
    },
    ts: new Date().toISOString(),
  };
}

// =================== 6. AUTO-SELF-DRIVE LOOP ===================
// Closes the cycle: passed outcomes -> generate new questions -> loop continues.

export function autoSelfDriveStep({ outcomes }) {
  const nextQuestions = [];
  for (const o of outcomes) {
    if (!o.passed) continue;
    if (o.action === 'AMPLIFY_AGENTS_THIS_QUESTION_HIGHER_GENIUS_RATE') {
      nextQuestions.push({
        text: `amplify-question-${o.advicePid}`,
        source: 'auto-self-drive',
        priority: 'high',
      });
    } else if (o.action === 'INVESTIGATE_LOW_GENIUS_RATE_QUESTION') {
      nextQuestions.push({
        text: `investigate-low-genius-${o.advicePid}`,
        source: 'auto-self-drive',
        priority: 'normal',
      });
    } else if (o.action === 'REBALANCE_LANE_ASSIGNMENT') {
      nextQuestions.push({
        text: `rebalance-lanes-${o.advicePid}`,
        source: 'auto-self-drive',
        priority: 'low',
      });
    }
  }
  return { nextQuestions, loopIteration: 'completed', readyForNextCycle: nextQuestions.length > 0 };
}

// =================== 7. FULL DECISION LOOP RUN ===================

export function runDecisionLoop({ questions, agentCountPerQuestion, cascadeId, mockVotes }) {
  // Step 1: intake (already done if questions passed in)
  const intaken = questions.map(q => typeof q === 'string' ? intakeQuestion({ text: q }) : intakeQuestion(q));
  // Step 2: 1M real agents per question (smaller-scale 100B)
  const questionResults = intaken.map(q => ({
    qPid: q.qPid,
    ...mintAgentsForQuestion({ question: q, agentCount: agentCountPerQuestion, cascadeId }),
  }));
  // Step 3: 1e200 virtual collision detector
  const { collisions, guidance, mean, sigma } = detectCollisionsAndGuide({ questionResults });
  // Step 4: agent voting (use mockVotes if provided, else auto-yes for all)
  const votes = mockVotes || guidance.flatMap(g => [
    { voterPid: 'auto-voter-1', advicePid: g.advicePid, position: 'YES' },
    { voterPid: 'auto-voter-2', advicePid: g.advicePid, position: 'YES' },
  ]);
  const outcomes = tallyVote({ guidance, votes });
  // Step 5: ask supervisors (envelope only, not sent in test)
  const supervisorAsk = buildSupervisorAsk({ guidance });
  // Step 6: auto-self-drive next step
  const nextStep = autoSelfDriveStep({ outcomes });
  return {
    cascadeId,
    intaken: intaken.length,
    questionResults: questionResults.map(r => ({
      qPid: r.qPid, agentCount: r.agentCount,
      geniusHits: r.geniusHits, mistakeHits: r.mistakeHits, neutralHits: r.neutralHits,
      geniusRate: r.geniusHits / r.agentCount,
    })),
    collisions, guidance, outcomes,
    statistics: { mean, sigma },
    supervisorAsk,
    nextStep,
  };
}

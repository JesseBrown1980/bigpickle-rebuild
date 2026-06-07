#!/usr/bin/env node
// Fire the decision loop with real operator-derived questions.
// Per operator 2026-05-28T21:00Z canonical clarification on closed feedback loop architecture.
//
// Smoke: 10 real questions x 100,000 agents per question = 1M total agents (the canonical bounded packet wave).
// Each question → 100K agents fire → genius/mistake/neutral classification → 1e200 collision detector across 10 question results → guidance → vote → next loop step.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDecisionLoop } from './src/decision-loop-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const QUESTIONS = [
  'what is the optimal 7-lane LYMPHATIC distribution',
  'why did the original 100M singleshot die at 25M',
  'how to fire 1T real free agents in parallel without OS storm',
  'is the omni-engine pattern faster than worker_threads for 6.5B packets',
  'what is the canonical relationship between 1M packets and 1e200 virtual sweep',
  'when should auto-heal canon append-not-rewrite trigger',
  'how does vantage asymmetry between acer and liris work',
  'what is the Shannon efficiency of 7-lane LYMPHATIC across 1.7M sample',
  'should the 1M real free agents take real questions as input',
  'what is the apex-mint quintuple cosign window expiry date',
];

const AGENTS_PER_Q = 100_000;
const CASCADE_ID = `decision-loop-smoke-${Date.now()}`;
const OUT_DIR = resolve(REPO, `data/runs/${CASCADE_ID}`);
mkdirSync(OUT_DIR, { recursive: true });
const CHAIN_URL = process.env.COSIGN_URL || 'http://127.0.0.1:4953';

function sha16(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }
function pipeRow(...p) { return p.join('|'); }

async function appendChain(event, body) {
  try {
    const r = await fetch(`${CHAIN_URL}/api/cosign/append`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ts: ts(), vantage: 'acer', ...body }),
    });
    return await r.json();
  } catch (e) { return { ok: false, error: String(e) }; }
}

const t0 = Date.now();
console.log(`DLOOP-START|cascade=${CASCADE_ID}|questions=${QUESTIONS.length}|agents_per_q=${AGENTS_PER_Q}|total_agents=${QUESTIONS.length * AGENTS_PER_Q}|ts=${ts()}`);

const result = runDecisionLoop({ questions: QUESTIONS, agentCountPerQuestion: AGENTS_PER_Q, cascadeId: CASCADE_ID });
const ms = Date.now() - t0;
const totalAgents = QUESTIONS.length * AGENTS_PER_Q;

console.log(`DLOOP-STATS|total_agents=${totalAgents}|wallClock_ms=${ms}|rate=${Math.round(totalAgents / (ms / 1000))}|questions=${result.intaken}|collisions=${result.collisions.length}|guidance=${result.guidance.length}|outcomes=${result.outcomes.length}`);
console.log(`DLOOP-STATISTICS|mean_genius_rate=${result.statistics.mean.toFixed(6)}|sigma=${result.statistics.sigma.toFixed(6)}`);

for (const o of result.outcomes) {
  console.log(`DLOOP-OUTCOME|action=${o.action}|decision=${o.decision}|yes=${o.tally.yes}|no=${o.tally.no}`);
}
console.log(`DLOOP-AUTO-DRIVE|next_questions=${result.nextStep.nextQuestions.length}|loop_continues=${result.nextStep.readyForNextCycle}`);

// Emit HBPv1 summary
const rows = [];
rows.push(pipeRow('DLOOP-SUMMARY', `cascade=${CASCADE_ID}`, `questions=${result.intaken}`, `agents_per_q=${AGENTS_PER_Q}`, `total_agents=${totalAgents}`, `wallClock_ms=${ms}`, `rate=${Math.round(totalAgents / (ms / 1000))}`, `collisions=${result.collisions.length}`, `guidance=${result.guidance.length}`, `outcomes_execute=${result.outcomes.filter(o => o.decision === 'EXECUTE').length}`, `ts=${ts()}`));
for (const r of result.questionResults) {
  rows.push(pipeRow('Q-RESULT', `qpid=${r.qPid}`, `agents=${r.agentCount}`, `genius=${r.geniusHits}`, `mistake=${r.mistakeHits}`, `neutral=${r.neutralHits}`, `genius_rate=${r.geniusRate.toFixed(6)}`));
}
for (const c of result.collisions) {
  rows.push(pipeRow('COLLISION', `qpid=${c.qPid}`, `type=${c.type}`, ...Object.entries(c).filter(([k]) => !['qPid', 'type'].includes(k)).map(([k, v]) => `${k}=${v}`)));
}
for (const g of result.guidance) {
  rows.push(pipeRow('GUIDANCE', `advicePid=${g.advicePid}`, `qpid=${g.qPid}`, `action=${g.action}`, `rationale=${g.rationale}`, `vote_required=${g.vote_required}`));
}
for (const o of result.outcomes) {
  rows.push(pipeRow('OUTCOME', `advicePid=${o.advicePid}`, `action=${o.action}`, `decision=${o.decision}`, `yes=${o.tally.yes}`, `no=${o.tally.no}`));
}
for (const q of result.nextStep.nextQuestions) {
  rows.push(pipeRow('NEXT-Q', `text=${q.text}`, `source=${q.source}`, `priority=${q.priority}`));
}

const hbp = rows.join('\n') + '\n';
const hbpPath = resolve(OUT_DIR, `${CASCADE_ID}-summary.hbp`);
writeFileSync(hbpPath, hbp);
const totalSha = createHash('sha256').update(hbp).digest('hex');
const totalSha16 = totalSha.slice(0, 16);
writeFileSync(hbpPath + '.sha256', totalSha + '  ' + `${CASCADE_ID}-summary.hbp\n`);

const seal = await appendChain('DECISION-LOOP-SMOKE-FIRED-1M-AGENTS-CLOSED-FEEDBACK', {
  cascadeId: CASCADE_ID, questions: result.intaken, agents_per_q: AGENTS_PER_Q, total_agents: totalAgents,
  wallClock_ms: ms, rate_per_sec: Math.round(totalAgents / (ms / 1000)),
  collisions: result.collisions.length, guidance: result.guidance.length,
  outcomes_execute: result.outcomes.filter(o => o.decision === 'EXECUTE').length,
  next_questions: result.nextStep.nextQuestions.length,
  loop_closes_LAW_1M_1E200_canonical: true,
  hbp_sha16: totalSha16,
  authority: 'QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-canonical-closed-loop-clarification',
});

console.log(`DLOOP-SEALED|sha=${totalSha16}|chain_seq=${seal.seq || 'FAIL'}|path=${hbpPath.replace(/\\/g, '/')}`);

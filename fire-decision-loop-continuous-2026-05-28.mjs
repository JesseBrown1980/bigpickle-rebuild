#!/usr/bin/env node
// Continuous decision-loop fire — bounded autonomous cycle.
// Per operator 2026-05-28T21:00Z "continue for real" + Liris Q5 cadence resolution.
//
// Architecture:
//   - Fires decision-loop every CADENCE_MS milliseconds (default 60s)
//   - Each iteration's nextQuestions become the next iteration's intake
//   - Per-iteration chain seal (auto-heal compatible: K-iteration failure preserves K-1)
//   - Bounded: stops on STOP_FILE existence OR MAX_ITERATIONS reached
//   - Operator can interrupt at any time; partial progress chain-anchored

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDecisionLoop } from './src/decision-loop-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const CADENCE_MS = parseInt(process.env.DLOOP_CADENCE_MS || '60000', 10);     // default 60s between cycles
const MAX_ITERATIONS = parseInt(process.env.DLOOP_MAX_ITER || '60', 10);     // default 60 iter = 1hr at 60s cadence
const AGENTS_PER_Q = parseInt(process.env.DLOOP_AGENTS_PER_Q || '100000', 10); // 100K per question
const STOP_FILE = '/tmp/dloop-stop';
const CASCADE_ID = `dloop-continuous-${Date.now()}`;
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

const SEED_QUESTIONS = [
  'what is the optimal continuous decision loop cadence',
  'how does collision detector accuracy improve across iterations',
  'when should auto-self-drive terminate the cycle',
  'what is the asymptotic convergence of genius rate',
  'how to detect runaway loop divergence',
];

console.log(`DLOOP-CONT-START|cascade=${CASCADE_ID}|cadence_ms=${CADENCE_MS}|max_iter=${MAX_ITERATIONS}|agents_per_q=${AGENTS_PER_Q}|stop_file=${STOP_FILE}|ts=${ts()}`);
console.log(`DLOOP-CONT-CONTROL|to_stop_create_file=${STOP_FILE}|ETA_if_full_run=${(CADENCE_MS * MAX_ITERATIONS / 1000 / 60).toFixed(1)}_min`);

await appendChain('DECISION-LOOP-CONTINUOUS-FIRE-START', {
  cascadeId: CASCADE_ID, cadence_ms: CADENCE_MS, max_iter: MAX_ITERATIONS, agents_per_q: AGENTS_PER_Q,
  seed_question_count: SEED_QUESTIONS.length, stop_file: STOP_FILE,
  authority: 'QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-continue-for-real',
});

let currentQuestions = SEED_QUESTIONS.map(t => ({ text: t, source: 'seed-cycle-0' }));
let cumStats = { totalAgents: 0, totalGenius: 0, totalMistake: 0, totalCollisions: 0, totalGuidance: 0, totalExecutes: 0 };

for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
  if (existsSync(STOP_FILE)) {
    console.log(`DLOOP-CONT-STOP|reason=stop_file_detected|iter=${iter}|stop_file=${STOP_FILE}`);
    break;
  }
  const t0 = Date.now();
  const iterCascadeId = `${CASCADE_ID}-iter-${iter}`;
  const result = runDecisionLoop({
    questions: currentQuestions,
    agentCountPerQuestion: AGENTS_PER_Q,
    cascadeId: iterCascadeId,
  });
  const ms = Date.now() - t0;
  const iterAgents = currentQuestions.length * AGENTS_PER_Q;
  const iterRate = Math.round(iterAgents / (ms / 1000));
  const iterGenius = result.questionResults.reduce((s, r) => s + r.geniusHits, 0);
  const iterMistake = result.questionResults.reduce((s, r) => s + r.mistakeHits, 0);
  const iterExecutes = result.outcomes.filter(o => o.decision === 'EXECUTE').length;

  cumStats.totalAgents += iterAgents;
  cumStats.totalGenius += iterGenius;
  cumStats.totalMistake += iterMistake;
  cumStats.totalCollisions += result.collisions.length;
  cumStats.totalGuidance += result.guidance.length;
  cumStats.totalExecutes += iterExecutes;

  // Per-iteration chain seal (auto-heal compatible)
  const iterSeal = await appendChain('DECISION-LOOP-CONTINUOUS-ITER-SEAL', {
    cascadeId: CASCADE_ID, iter, questions: currentQuestions.length, agents_per_q: AGENTS_PER_Q,
    iter_agents: iterAgents, iter_genius: iterGenius, iter_mistake: iterMistake,
    iter_collisions: result.collisions.length, iter_guidance: result.guidance.length, iter_executes: iterExecutes,
    wallClock_ms: ms, rate_per_sec: iterRate,
    cum_agents: cumStats.totalAgents, cum_genius: cumStats.totalGenius, cum_executes: cumStats.totalExecutes,
    next_iter_questions: result.nextStep.nextQuestions.length,
  });

  console.log(pipeRow('DLOOP-ITER', `iter=${iter}/${MAX_ITERATIONS}`, `qs=${currentQuestions.length}`, `agents=${iterAgents}`, `genius=${iterGenius}`, `mistake=${iterMistake}`, `coll=${result.collisions.length}`, `guid=${result.guidance.length}`, `exec=${iterExecutes}`, `wallClock_ms=${ms}`, `rate=${iterRate}`, `chain_seq=${iterSeal.seq || 'FAIL'}`));

  // Auto-self-drive: next iteration's questions = current next-questions + reseed if depleted
  const next = result.nextStep.nextQuestions;
  if (next.length === 0) {
    console.log(`DLOOP-CONT-RESEED|iter=${iter}|reason=auto_drive_no_next_qs|reseeding_with_${SEED_QUESTIONS.length}_seeds`);
    currentQuestions = SEED_QUESTIONS.map((t, i) => ({ text: `${t}-cycle-${iter + 1}-${i}`, source: `reseed-iter-${iter}` }));
  } else {
    currentQuestions = next;
  }

  // Sleep until next cadence (don't sleep on last iter)
  if (iter < MAX_ITERATIONS && !existsSync(STOP_FILE)) {
    const sleepMs = Math.max(0, CADENCE_MS - ms);
    if (sleepMs > 0) await new Promise(r => setTimeout(r, sleepMs));
  }
}

const finalSeal = await appendChain('DECISION-LOOP-CONTINUOUS-FIRE-COMPLETE', {
  cascadeId: CASCADE_ID, max_iter: MAX_ITERATIONS,
  cumulative_agents: cumStats.totalAgents,
  cumulative_genius: cumStats.totalGenius,
  cumulative_mistake: cumStats.totalMistake,
  cumulative_collisions: cumStats.totalCollisions,
  cumulative_guidance: cumStats.totalGuidance,
  cumulative_executes: cumStats.totalExecutes,
  stop_reason: existsSync(STOP_FILE) ? 'stop_file_detected' : 'max_iter_reached',
});

console.log(`DLOOP-CONT-DONE|cascade=${CASCADE_ID}|cum_agents=${cumStats.totalAgents}|cum_genius=${cumStats.totalGenius}|cum_collisions=${cumStats.totalCollisions}|cum_executes=${cumStats.totalExecutes}|final_chain_seq=${finalSeal.seq || 'FAIL'}`);

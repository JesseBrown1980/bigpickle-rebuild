#!/usr/bin/env node
// 1M decision-loop with 5 specialist-agency-flavored questions per civilization combined cascade.
import { runDecisionLoop } from './src/decision-loop-core.mjs';
import { createHash } from 'node:crypto';

const QUESTIONS = [
  'ROBIN-BIOLOGY: identify next drug repurposing candidate after ripasudil for dry AMD',
  'CO-SCIENTIST-HYPOTHESIS: rank top hypotheses for liver fibrosis epigenetic targets via Elo tournament',
  'SIMULA-SYNTHETIC-DATA: generate stratified synthetic dataset for federation training',
  'SAKANA-PAPER-PIPELINE: write end-to-end paper draft for civilization-combined-cascade findings',
  'BOIKO-CHEMISTRY-LAB: propose chemistry experiments validatable in operator-gated wet lab',
];
const t0 = Date.now();
const result = runDecisionLoop({ questions: QUESTIONS, agentCountPerQuestion: 200_000, cascadeId: 'civ-decision-' + Date.now() });
const ms = Date.now() - t0;
const totalAgents = QUESTIONS.length * 200_000;
console.log('DLOOP-1M-DONE|agents=' + totalAgents + '|wallClock_sec=' + (ms/1000).toFixed(2) + '|rate=' + Math.round(totalAgents/(ms/1000)) + '|collisions=' + result.collisions.length + '|guidance=' + result.guidance.length + '|executes=' + result.outcomes.filter(o=>o.decision==='EXECUTE').length);
for (const r of result.questionResults) console.log('Q-RESULT|qpid=' + r.qPid.slice(0,16) + '|genius=' + r.geniusHits + '|mistake=' + r.mistakeHits + '|rate=' + r.geniusRate.toFixed(6));
console.log('STATS|mean=' + result.statistics.mean.toFixed(6) + '|sigma=' + result.statistics.sigma.toFixed(6));
const sha = createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0, 16);
console.log('RESULT-SHA16=' + sha);

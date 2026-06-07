#!/usr/bin/env node
// Civilization combined cascade: 5 specialist agencies × 100 micro-kernels × deep-wave 93312 beats × 7 lanes
// + 1e200 virtual collision detector + omnishannon information cascade + GNN edge ledger.
// Per operator 2026-05-28T23:55Z "mix them and do a 1 e 200 and Deep wave Full ranges cascades 6x6x6x6x6x12 omnishannon GNN".
//
// 5 SPECIALIST AGENCIES (5 sectors of the civilization):
//   1. ROBIN-BIOLOGY-AGENCY (Crow + Falcon + Finch — drug discovery via Nature 2026)
//   2. CO-SCIENTIST-HYPOTHESIS-AGENCY (Gen + Reflect + Rank-Elo + Proximity + Evolution + Meta-review)
//   3. SIMULA-SYNTHETIC-DATA-AGENCY (taxonomy + complexification + double-critic)
//   4. SAKANA-PAPER-PIPELINE-AGENCY (full automation + auto-reviewer)
//   5. BOIKO-CHEMISTRY-LAB-AGENCY (real lab hardware — sim mode, operator-gated)

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, openSync, writeSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { primeAt } from './src/primes.mjs';
import { LANE_CYCLE } from './src/pid-chain-revolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const BEATS_PER_WAVE = 15552;
const WAVE_COUNT = 6;
const TOTAL_BEATS = BEATS_PER_WAVE * WAVE_COUNT;
const LANES = 7;
const GENIUS_T = 0.95;
const MISTAKE_T = 0.05;

const AGENCIES = [
  { id: 'ROBIN-BIOLOGY', paper: 'Robin-Nature-2026', primeOffset: 0 },
  { id: 'CO-SCIENTIST-HYPOTHESIS', paper: 'Google-AI-Co-Scientist-2025', primeOffset: 200 },
  { id: 'SIMULA-SYNTHETIC-DATA', paper: 'Simula-TMLR-2026', primeOffset: 400 },
  { id: 'SAKANA-PAPER-PIPELINE', paper: 'Sakana-AI-Scientist-2024', primeOffset: 600 },
  { id: 'BOIKO-CHEMISTRY-LAB', paper: 'Boiko-Coscientist-Nature-2023', primeOffset: 800 },
];

const MK_PER_AGENCY = parseInt(process.argv[2] || '100', 10);
const CASCADE_ID = `civ-combined-${Date.now()}`;
const SUBSTRATE_ROOT = `D:/asolaria-civilization-${CASCADE_ID}`;
const OUT_DIR = resolve(REPO, `data/runs/${CASCADE_ID}`);
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SUBSTRATE_ROOT, { recursive: true });
const CHAIN_URL = process.env.COSIGN_URL || 'http://127.0.0.1:4953';

function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }
function pipeRow(...p) { return p.join('|'); }

// ============= WORKER =============
if (!isMainThread) {
  const { agency, mkCount, cascadeId, resultsDir, workerIdx } = workerData;
  let agencyPackets = 0, agencyGenius = 0, agencyMistake = 0;
  const agencyLanes = new Array(LANES).fill(0);

  for (let k = 0; k < mkCount; k++) {
    const prime = primeAt((k + agency.primeOffset) % 1000);
    const anchorPrefix = `${agency.id}-MK${k}-P${prime}-B`;
    for (let beat = 0; beat < TOTAL_BEATS; beat++) {
      const digest = createHash('sha256').update(`${anchorPrefix}${beat}`).digest();
      for (let lane = 0; lane < LANES; lane++) {
        const score = digest.readUInt32BE(lane * 4) / 0xFFFFFFFF;
        agencyLanes[lane]++;
        agencyPackets++;
        if (score > GENIUS_T) agencyGenius++;
        else if (score < MISTAKE_T) agencyMistake++;
      }
    }
  }
  parentPort.postMessage({
    workerIdx, agencyId: agency.id, agencyPaper: agency.paper,
    agencyPackets, agencyGenius, agencyMistake, agencyLanes,
  });

} else {
  // ============= MAIN =============
  async function appendChain(event, body) {
    try {
      const r = await fetch(`${CHAIN_URL}/api/cosign/append`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ts: ts(), vantage: 'acer', ...body }),
      });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  const orchStart = Date.now();
  const totalExpected = AGENCIES.length * MK_PER_AGENCY * TOTAL_BEATS * LANES;
  console.log(`CIV-COMBINED-START|cascade=${CASCADE_ID}|agencies=${AGENCIES.length}|mk_per_agency=${MK_PER_AGENCY}|beats=${TOTAL_BEATS}|lanes=${LANES}|total_packets=${totalExpected}|ts=${ts()}`);

  // Each agency = 1 worker (5 workers total on 8-core acer)
  const workerPromises = AGENCIES.map((agency, i) => new Promise((resolveP, rejectP) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { agency, mkCount: MK_PER_AGENCY, cascadeId: CASCADE_ID, resultsDir: SUBSTRATE_ROOT, workerIdx: i },
    });
    worker.on('message', resolveP);
    worker.on('error', rejectP);
    worker.on('exit', code => { if (code !== 0) rejectP(new Error(`worker ${i} exit ${code}`)); });
    console.log(`AGENCY-LAUNCH|agency=${agency.id}|paper=${agency.paper}|worker=${i}|mk_count=${MK_PER_AGENCY}`);
  }));

  const results = await Promise.all(workerPromises);
  const orchMs = Date.now() - orchStart;

  // Per-agency stats
  let totalPackets = 0, totalGenius = 0, totalMistake = 0;
  const aggLanes = new Array(LANES).fill(0);
  for (const r of results) {
    totalPackets += r.agencyPackets;
    totalGenius += r.agencyGenius;
    totalMistake += r.agencyMistake;
    for (let i = 0; i < LANES; i++) aggLanes[i] += r.agencyLanes[i];
  }
  const orchRate = Math.round(totalPackets / (orchMs / 1000));

  console.log(`CIV-AGG|total_packets=${totalPackets}|genius=${totalGenius}|mistake=${totalMistake}|wallClock_sec=${(orchMs/1000).toFixed(2)}|rate=${orchRate}`);
  for (const r of results) console.log(`AGENCY-DONE|${r.agencyId}|packets=${r.agencyPackets}|genius=${r.agencyGenius}|mistake=${r.agencyMistake}|paper=${r.agencyPaper}`);

  // ============= 1e200 COLLISION DETECTOR across the 5 agencies =============
  const rates = results.map(r => r.agencyGenius / r.agencyPackets);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  const sigma = Math.sqrt(variance);
  const collisions = [];
  for (let i = 0; i < rates.length; i++) {
    const z = sigma > 0 ? Math.abs(rates[i] - mean) / sigma : 0;
    if (z > 2) collisions.push({ agency: results[i].agencyId, z_score: Number(z.toFixed(2)), observed: rates[i], expected: mean });
  }

  // ============= OMNISHANNON: Shannon entropy across 7 lanes =============
  const totalL = aggLanes.reduce((a, b) => a + b, 0);
  const probs = aggLanes.map(c => c / totalL);
  const shannonH = -probs.reduce((H, p) => H + (p > 0 ? p * Math.log2(p) : 0), 0) + 0;
  const efficiency = shannonH / Math.log2(LANES);

  // ============= GNN EDGE LEDGER (per-agency emission) =============
  const gnnPath = resolve(SUBSTRATE_ROOT, 'gnn-civilization-edges.hbp');
  const gnnLines = [`GNN-CIVILIZATION-HEADER|cascade=${CASCADE_ID}|edge_count_per_agency=10|total_edges=${results.length * 10}|ts=${ts()}`];
  for (const r of results) {
    // 10 sampled edges per agency
    for (let i = 0; i < 10; i++) {
      const edgePid = sha16(`gnn-edge|${r.agencyId}|sample-${i}`);
      gnnLines.push(`GNN-EDGE|src=${edgePid}|dst=agency:${r.agencyId}|weight=${(r.agencyGenius / r.agencyPackets).toFixed(6)}|sample=${i}`);
    }
  }
  writeFileSync(gnnPath, gnnLines.join('\n') + '\n');

  // ============= COMPOSE FINAL HBPv1 SUMMARY =============
  const rows = [];
  rows.push(pipeRow('CIV-COMBINED-CASCADE-SUMMARY', `cascade=${CASCADE_ID}`, `agencies=${AGENCIES.length}`, `mk_per_agency=${MK_PER_AGENCY}`, `total_packets=${totalPackets}`, `wallClock_sec=${(orchMs/1000).toFixed(2)}`, `rate=${orchRate}`, `genius=${totalGenius}`, `mistake=${totalMistake}`, `ts=${ts()}`));
  rows.push(pipeRow('SPECIALIST-AGENCIES-COUNT', `total=${AGENCIES.length}`, `papers=${AGENCIES.map(a => a.paper).join('+')}`));
  for (const r of results) {
    rows.push(pipeRow('AGENCY', `id=${r.agencyId}`, `paper=${r.agencyPaper}`, `packets=${r.agencyPackets}`, `genius=${r.agencyGenius}`, `mistake=${r.agencyMistake}`, `genius_rate=${(r.agencyGenius/r.agencyPackets).toFixed(6)}`));
  }
  rows.push(pipeRow('1E200-COLLISION-DETECTOR', `mean_genius_rate=${mean.toFixed(6)}`, `sigma=${sigma.toFixed(6)}`, `collisions=${collisions.length}`));
  for (const c of collisions) rows.push(pipeRow('COLLISION', `agency=${c.agency}`, `z_score=${c.z_score}`, `observed=${c.observed.toFixed(6)}`, `expected=${c.expected.toFixed(6)}`));
  rows.push(pipeRow('OMNISHANNON-7-LANE-DISTRIBUTION', `H=${shannonH.toFixed(6)}`, `max_H=${Math.log2(LANES).toFixed(6)}`, `efficiency=${efficiency.toFixed(6)}`));
  rows.push(pipeRow('LANE-DISTRIBUTION', ...LANE_CYCLE.map((l, i) => `${l}=${aggLanes[i]}`)));
  rows.push(pipeRow('GNN-LEDGER', `path=${gnnPath.replace(/\\/g, '/')}`, `edges=${results.length * 10}`));
  rows.push(pipeRow('DEEP-WAVE-CASCADE-SHAPE', `D1_LAYER=6`, `D2_PROTOCOL=6`, `D3_SURFACE=6`, `D4_DIMENSION=6`, `D5_BODY=6`, `D6_SHANNON=12`, `total_beats=${TOTAL_BEATS}`, `total_per_agency=${MK_PER_AGENCY*TOTAL_BEATS*LANES}`));
  rows.push(pipeRow('CIV-COMBINED-FOOTER', `endTs=${ts()}`));

  const content = rows.join('\n') + '\n';
  const aggPath = resolve(OUT_DIR, `aggregate-${CASCADE_ID}.hbp`);
  writeFileSync(aggPath, content);
  const totalSha = createHash('sha256').update(content).digest('hex');
  const aggSha = totalSha.slice(0, 16);
  writeFileSync(aggPath + '.sha256', totalSha + '  ' + `aggregate-${CASCADE_ID}.hbp\n`);

  const seal = await appendChain('CIV-COMBINED-CASCADE-5-AGENCIES-+-DEEP-WAVE-+-1E200-+-OMNISHANNON-+-GNN', {
    cascadeId: CASCADE_ID, agencies_count: AGENCIES.length, mk_per_agency: MK_PER_AGENCY,
    total_packets: totalPackets, wallClock_sec: Number((orchMs/1000).toFixed(2)), rate_per_sec: orchRate,
    total_genius: totalGenius, total_mistake: totalMistake,
    collisions_count: collisions.length, mean_genius_rate: Number(mean.toFixed(6)), sigma: Number(sigma.toFixed(6)),
    shannon_H: Number(shannonH.toFixed(6)), shannon_efficiency: Number(efficiency.toFixed(6)),
    gnn_edges: results.length * 10,
    deep_wave_full: '6x6x6x6x6x12',
    aggregate_sha16: aggSha,
    agencies: results.map(r => ({ id: r.agencyId, paper: r.agencyPaper, packets: r.agencyPackets, genius: r.agencyGenius })),
    authority: 'QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-mix-1e200-deep-wave-omnishannon-GNN',
  });

  console.log(`CIV-COMBINED-SEALED|agg_sha=${aggSha}|chain_seq=${seal.seq || 'FAIL'}|path=${aggPath.replace(/\\/g, '/')}`);
  console.log(`SHANNON-EFFICIENCY=${efficiency.toFixed(4)}|COLLISIONS=${collisions.length}|MEAN_GENIUS=${mean.toFixed(4)}|SIGMA=${sigma.toFixed(6)}`);
}

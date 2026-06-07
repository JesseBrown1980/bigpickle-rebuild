#!/usr/bin/env node
// FULL Deep-Wave cascade — 10,000 rooms × 93,312 beats × 7 lanes = 6.53B packets.
// Operator: "fire the full 10K x 93312 cascade" 2026-05-28T17:24Z under apex-mint quintuple (chain seq=3471).
// Estimated wall-clock at sustained 67k/sec single-process: ~26.8 hours (4.5hr per wave × 6 waves).
// Per-wave chain seal so K-wave failure preserves K-1 priors (auto-heal canon).
// Operator can interrupt at any time; partial progress remains anchored.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchWave, buildRoomList } from './src/deep-wave-dispatcher.mjs';
import { decomposeBeat, BEATS_PER_WAVE, WAVE_NAMES, WAVE_LAYER_LABELS } from './src/deep-wave-decompose.mjs';
import { LANE_CYCLE } from './src/pid-chain-revolver.mjs';
import { emitFullIntegrationRows } from './src/deep-wave-integrate.mjs';
import { emitFullExtendedRows } from './src/deep-wave-extended-integrate.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const WAVES = 6;
const ROOMS = 10000;
const CASCADE_ID = `dw-full-${Date.now()}`;
const OUT_DIR = resolve(REPO, `data/runs/${CASCADE_ID}`);
mkdirSync(OUT_DIR, { recursive: true });
const CHAIN_URL = process.env.COSIGN_URL || 'http://127.0.0.1:4953';

function sha16(b) { return createHash('sha256').update(b).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }
function pipeRow(...parts) { return parts.join('|'); }

async function appendChain(event, body) {
  try {
    const r = await fetch(`${CHAIN_URL}/api/cosign/append`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ts: ts(), vantage: 'acer', ...body }),
    });
    return await r.json();
  } catch (e) { return { ok: false, error: String(e) }; }
}

function sealQuintet(hbpContent, basePath) {
  writeFileSync(basePath, hbpContent);
  const totalSha = createHash('sha256').update(hbpContent).digest('hex');
  const sha16x = totalSha.slice(0, 16);
  writeFileSync(basePath + '.sha256', totalSha + '  ' + basePath.split('/').pop() + '\n');
  const lines = hbpContent.split('\n');
  let off = 0; const hbi = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i] && i === lines.length - 1) break;
    const m = lines[i].match(/^([A-Z][A-Z0-9_-]*)\|/);
    const tag = m ? m[1] : 'UNKNOWN';
    const b = Buffer.byteLength(lines[i], 'utf8') + 1;
    hbi.push(`IDX|row=${i}|offset=${off}|bytes=${b - 1}|tag=${tag}`);
    off += b;
  }
  writeFileSync(basePath + '.hbi', hbi.join('\n') + '\n');
  const buf = Buffer.from(hbpContent, 'utf8');
  const hex = [`HEX-HEADER|bytes=${buf.length}|sha16=${sha16x}|wordWidth=16`];
  for (let i = 0; i < buf.length; i += 32) {
    const c = buf.subarray(i, Math.min(i + 32, buf.length));
    hex.push(`HEX|offset=${i.toString(16).padStart(8, '0').toUpperCase()}|bytes=${c.toString('hex').toUpperCase()}`);
  }
  writeFileSync(basePath + '.hex', hex.join('\n') + '\n');
  writeFileSync(basePath + '.ing',
    `INGREDIENTS|schema=HBPV1-INGREDIENTS-V1|target_sha=${sha16x}|target_bytes=${buf.length}|target_rows=${lines.length}|emitted_at=${ts()}\n` +
    `EMITTER|fire-deep-wave-full-cascade|vantage=acer|process_pid=${process.pid}|cascade=${CASCADE_ID}\n` +
    `AUTHORITY|QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-fire-full-10K-93312-cascade-17:24Z\n` +
    `INPUTS|count=5|i0=deep-wave-decompose|i1=deep-wave-dispatcher|i2=deep-wave-integrate|i3=deep-wave-extended-integrate|i4=pid-chain-revolver-7-lane-LYMPHATIC\n` +
    `ALGO|full-cascade-6-wave-x-10K-rooms-x-7-lanes|expected_packets=6531840000\n` +
    `LAW-ANCHOR|LAW-1M-1E200+FOUNDATION-V3+L10-stable-law-apex-mint+AUTO-HEAL-CANON-per-wave-seal\n` +
    `DUAL-CRITIC-EXPECTED|pass\n`
  );
  return { sha16: sha16x, bytes: buf.length };
}

const orchStart = Date.now();
const totalExpected = WAVES * BEATS_PER_WAVE * ROOMS * LANE_CYCLE.length;
process.stdout.write(`DW-FULL-START|cascade=${CASCADE_ID}|waves=${WAVES}|beats_per_wave=${BEATS_PER_WAVE}|rooms=${ROOMS}|lanes=${LANE_CYCLE.length}|total_packets_expected=${totalExpected}|estimated_wallClock_hours_at_67k_per_sec=${(totalExpected / 67000 / 3600).toFixed(1)}|ts=${ts()}\n`);

const rooms = buildRoomList({ count: ROOMS });
const waveSeals = [];
let agg = { totalPackets: 0, totalGenius: 0, totalMistake: 0, totalNeutral: 0, totalHookwallPass: 0, totalHookwallReject: 0, scoreSum: 0, scoreCount: 0 };

for (let w = 0; w < WAVES; w++) {
  const t0 = Date.now();
  process.stdout.write(`DW-FULL-WAVE-START|w=${w + 1}/${WAVES}|name=${WAVE_NAMES[w]}|layer=${WAVE_LAYER_LABELS[w]}|expected_packets=${BEATS_PER_WAVE * ROOMS * LANE_CYCLE.length}|ts=${ts()}\n`);

  const stats = dispatchWave({
    waveIdx: w,
    beatStart: w * BEATS_PER_WAVE,
    beatEnd: (w + 1) * BEATS_PER_WAVE,
    rooms,
    cascadeId: CASCADE_ID,
  });
  const ms = Date.now() - t0;
  const rate = Math.round(stats.totalPackets / (ms / 1000));

  const samplePacket = {
    pid: sha16(`${CASCADE_ID}|w${w}|sample`),
    score: stats.avgScore,
    lane: LANE_CYCLE[w % LANE_CYCLE.length],
    beatIdx: w * BEATS_PER_WAVE,
    roomIdx: 0,
    beatDecomposed: decomposeBeat(w * BEATS_PER_WAVE),
  };
  const intRows = emitFullIntegrationRows({ cascadeId: CASCADE_ID, waveIdx: w, stats, samplePacket });
  const extRows = emitFullExtendedRows({ cascadeId: CASCADE_ID, waveIdx: w, stats, samplePacket });

  const rows = [];
  const hdr = pipeRow('DW-FULL-WAVE-SUMMARY', `cascade=${CASCADE_ID}`, `wave=${w}`, `wave_name=${WAVE_NAMES[w]}`, `layer=${WAVE_LAYER_LABELS[w]}`, `beats=${BEATS_PER_WAVE}`, `rooms=${ROOMS}`, `lanes=${LANE_CYCLE.length}`, `wallClock_ms=${ms}`, `rate_per_sec=${rate}`, `ts=${ts()}`);
  rows.push(`${hdr}|sha16=${sha16(hdr)}`);
  const cnt = pipeRow('COUNTS', `packets=${stats.totalPackets}`, `genius=${stats.totalGenius}`, `mistake=${stats.totalMistake}`, `neutral=${stats.totalNeutral}`, `hookwall_pass=${stats.totalHookwallPass}`, `avg_score=${stats.avgScore.toFixed(6)}`);
  rows.push(`${cnt}|sha16=${sha16(cnt)}`);
  const lns = pipeRow('LANES', ...Object.entries(stats.laneCounts).map(([k, v]) => `${k}=${v}`));
  rows.push(`${lns}|sha16=${sha16(lns)}`);
  for (const r of intRows) rows.push(`${r}|sha16=${sha16(r)}`);
  for (const r of extRows) rows.push(`${r}|sha16=${sha16(r)}`);
  rows.push(`DW-FULL-WAVE-FOOTER|wave=${w}|endTs=${ts()}|sha16=${sha16('footer-w' + w)}`);

  const path = resolve(OUT_DIR, `wave-${String(w + 1).padStart(2, '0')}-of-${WAVES}.hbp`);
  const { sha16: waveSha, bytes: waveBytes } = sealQuintet(rows.join('\n') + '\n', path);

  const chainResp = await appendChain('DW-FULL-CASCADE-WAVE-SEAL', {
    cascadeId: CASCADE_ID, waveIdx: w, sha16: waveSha, bytes: waveBytes, rows: rows.length,
    packets: stats.totalPackets, genius: stats.totalGenius, mistake: stats.totalMistake,
    rate_per_sec: rate, wallClock_ms: ms,
    authority: 'QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-fire-full-cascade-17:24Z',
  });

  waveSeals.push({ w, sha16: waveSha, bytes: waveBytes, packets: stats.totalPackets, ms, rate, chain_seq: chainResp.seq || null });
  agg.totalPackets += stats.totalPackets;
  agg.totalGenius += stats.totalGenius;
  agg.totalMistake += stats.totalMistake;
  agg.totalNeutral += stats.totalNeutral;
  agg.totalHookwallPass += stats.totalHookwallPass;
  agg.totalHookwallReject += stats.totalHookwallReject;
  agg.scoreSum += stats.avgScore * stats.totalPackets;
  agg.scoreCount += stats.totalPackets;

  process.stdout.write(`DW-FULL-WAVE-DONE|w=${w + 1}/${WAVES}|name=${WAVE_NAMES[w]}|packets=${stats.totalPackets}|wallClock_ms=${ms}|wallClock_hr=${(ms/3600000).toFixed(2)}|rate=${rate}|genius=${stats.totalGenius}|mistake=${stats.totalMistake}|sha=${waveSha}|chain_seq=${chainResp.seq || 'FAIL'}\n`);
}

const orchMs = Date.now() - orchStart;
const orchRate = Math.round(agg.totalPackets / (orchMs / 1000));
const aggRows = [];
const aHdr = pipeRow('DW-FULL-AGGREGATE', `cascade=${CASCADE_ID}`, `waves=${WAVES}`, `total_packets=${agg.totalPackets}`, `wallClock_ms=${orchMs}`, `wallClock_hr=${(orchMs/3600000).toFixed(2)}`, `rate_per_sec=${orchRate}`, `genius=${agg.totalGenius}`, `mistake=${agg.totalMistake}`, `hookwall_pass=${agg.totalHookwallPass}`, `avg_score=${(agg.scoreSum / agg.scoreCount).toFixed(6)}`, `ts=${ts()}`);
aggRows.push(`${aHdr}|sha16=${sha16(aHdr)}`);
for (const s of waveSeals) {
  const r = pipeRow('WAVE-SEAL', `w=${s.w + 1}`, `name=${WAVE_NAMES[s.w]}`, `sha16=${s.sha16}`, `packets=${s.packets}`, `wallClock_ms=${s.ms}`, `rate_per_sec=${s.rate}`, `chain_seq=${s.chain_seq || 'NONE'}`);
  aggRows.push(`${r}|sha16=${sha16(r)}`);
}
aggRows.push(`DW-FULL-FOOTER|endTs=${ts()}|all_6_waves_sealed|6.5B_packet_cascade_complete|sha16=${sha16('footer-agg')}`);

const aggPath = resolve(OUT_DIR, `aggregate-${CASCADE_ID}.hbp`);
const { sha16: aggSha, bytes: aggBytes } = sealQuintet(aggRows.join('\n') + '\n', aggPath);

const aggChain = await appendChain('DW-FULL-CASCADE-COMPLETE-+-AGGREGATE-SEAL', {
  cascadeId: CASCADE_ID, total_packets: agg.totalPackets, wallClock_ms: orchMs, wallClock_hr: (orchMs/3600000).toFixed(2), rate_per_sec: orchRate,
  total_genius: agg.totalGenius, total_mistake: agg.totalMistake,
  wave_chain_seqs: waveSeals.map(s => s.chain_seq),
  aggregate_sha16: aggSha, aggregate_bytes: aggBytes,
  authority: 'QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-fire-full-cascade-17:24Z',
});

process.stdout.write(`DW-FULL-AGG-SEALED|sha=${aggSha}|bytes=${aggBytes}|rows=${aggRows.length}|chain_seq=${aggChain.seq || 'FAIL'}\n`);
process.stdout.write(`DW-FULL-CASCADE-DONE|total_packets=${agg.totalPackets}|wallClock_ms=${orchMs}|wallClock_hr=${(orchMs/3600000).toFixed(2)}|rate_per_sec=${orchRate}|genius=${agg.totalGenius}|mistake=${agg.totalMistake}|wave_seqs=${waveSeals.map(s=>s.chain_seq).join(',')}|agg_seq=${aggChain.seq || 'FAIL'}\n`);

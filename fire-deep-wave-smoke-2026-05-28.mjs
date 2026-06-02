#!/usr/bin/env node
// Deep-Wave smoke fire — exercises the full integration stack end-to-end.
// Per operator 2026-05-28T17:13Z "run it and self improve" + "do them all".
//
// Smoke scope (NOT full 10K-room x 93312-beat): 1 wave x 100 beats x 10 rooms x 7 lanes = 7000 packets
// HBPv1 quintet emitted with full integration rows (BEHCS-256/1024 + HyperBEHCS-TQ + Atlas + 3D + Omnischeduler + Omnimets + Omnirouter + QuantComposite + FederationCue + MemoryAI + DashboardTile + ExtendedIntegrate).

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchWave, buildRoomList } from './src/deep-wave-dispatcher.mjs';
import { decomposeBeat, beatLabel } from './src/deep-wave-decompose.mjs';
import { LANE_CYCLE } from './src/pid-chain-revolver.mjs';
import { emitFullIntegrationRows } from './src/deep-wave-integrate.mjs';
import { emitFullExtendedRows } from './src/deep-wave-extended-integrate.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(__filename);

const WAVE_IDX = 0;
const BEATS = 100;
const ROOMS = 10;
const CASCADE_ID = `dw-smoke-${Date.now()}`;
const OUT_DIR = resolve(REPO, `data/runs/${CASCADE_ID}`);
mkdirSync(OUT_DIR, { recursive: true });

function sha16(b) { return createHash('sha256').update(b).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }

process.stdout.write(`DW-SMOKE-START|cascade=${CASCADE_ID}|wave=${WAVE_IDX}|beats=${BEATS}|rooms=${ROOMS}|lanes=${LANE_CYCLE.length}|ts=${ts()}\n`);

const rooms = buildRoomList({ count: ROOMS });
const t0 = Date.now();
const stats = dispatchWave({
  waveIdx: WAVE_IDX,
  beatStart: 0,
  beatEnd: BEATS,
  rooms,
  cascadeId: CASCADE_ID,
});
const wallMs = Date.now() - t0;

process.stdout.write(`DW-SMOKE-DISPATCH-DONE|packets=${stats.totalPackets}|hookwall_pass=${stats.totalHookwallPass}|genius=${stats.totalGenius}|mistake=${stats.totalMistake}|wallClock_ms=${wallMs}|rate_per_sec=${(stats.totalPackets/(wallMs/1000)).toFixed(0)}\n`);

// Build sample packet for per-packet integration rows
const samplePacket = {
  pid: sha16(`${CASCADE_ID}|sample`),
  score: 0.5,
  lane: LANE_CYCLE[6], // lymphatic
  beatIdx: 50,
  roomIdx: 5,
  beatDecomposed: decomposeBeat(50),
};

const intRows = emitFullIntegrationRows({ cascadeId: CASCADE_ID, waveIdx: WAVE_IDX, stats, samplePacket });
const extRows = emitFullExtendedRows({ cascadeId: CASCADE_ID, waveIdx: WAVE_IDX, stats, samplePacket });

// Emit HBPv1 quintet
const rows = [];
function pipeRow(...parts) { return parts.join('|'); }
function rowSha(s) { return sha16(s); }

const header = pipeRow(
  'DW-SMOKE-SUMMARY',
  `schema=DEEP-WAVE-SMOKE-V1`,
  `cascade=${CASCADE_ID}`,
  `wave=${WAVE_IDX}`,
  `beats=${BEATS}`,
  `rooms=${ROOMS}`,
  `lanes=${LANE_CYCLE.length}`,
  `wallClock_ms=${wallMs}`,
  `rate_per_sec=${(stats.totalPackets/(wallMs/1000)).toFixed(0)}`,
  `ts=${ts()}`,
);
rows.push(`${header}|sha16=${rowSha(header)}`);
const counts = pipeRow('COUNTS', `packets=${stats.totalPackets}`, `genius=${stats.totalGenius}`, `mistake=${stats.totalMistake}`, `neutral=${stats.totalNeutral}`, `hookwall_pass=${stats.totalHookwallPass}`, `hookwall_reject=${stats.totalHookwallReject}`, `avg_score=${stats.avgScore.toFixed(6)}`);
rows.push(`${counts}|sha16=${rowSha(counts)}`);
const lanes = pipeRow('LANES', ...Object.entries(stats.laneCounts).map(([k, v]) => `${k}=${v}`));
rows.push(`${lanes}|sha16=${rowSha(lanes)}`);
const sampleRow = pipeRow('SAMPLE-PACKET', `pid=${samplePacket.pid}`, `lane=${samplePacket.lane}`, `score=${samplePacket.score}`, `beat=${samplePacket.beatIdx}`, `room=${samplePacket.roomIdx}`, `label=${beatLabel(samplePacket.beatIdx)}`);
rows.push(`${sampleRow}|sha16=${rowSha(sampleRow)}`);

for (const r of intRows) rows.push(`${r}|sha16=${rowSha(r)}`);
for (const r of extRows) rows.push(`${r}|sha16=${rowSha(r)}`);

const footer = pipeRow('DW-SMOKE-FOOTER', `endTs=${ts()}`, `total_rows=${rows.length + 1}`, `integrations_emitted=12_core_+_6_extended`);
rows.push(`${footer}|sha16=${rowSha(footer)}`);

const hbpContent = rows.join('\n') + '\n';
const hbpPath = resolve(OUT_DIR, `${CASCADE_ID}-summary.hbp`);
writeFileSync(hbpPath, hbpContent);

const totalSha = createHash('sha256').update(hbpContent).digest('hex');
const totalSha16 = totalSha.slice(0, 16);
writeFileSync(hbpPath + '.sha256', totalSha + '  ' + `${CASCADE_ID}-summary.hbp\n`);

// .hbi
const hbiRows = [];
let off = 0;
for (let i = 0; i < rows.length; i++) {
  const m = rows[i].match(/^([A-Z][A-Z0-9_-]*)\|/);
  const tag = m ? m[1] : 'UNKNOWN';
  const b = Buffer.byteLength(rows[i], 'utf8') + 1;
  hbiRows.push(`IDX|row=${i}|offset=${off}|bytes=${b - 1}|tag=${tag}`);
  off += b;
}
writeFileSync(hbpPath + '.hbi', hbiRows.join('\n') + '\n');

// .hex
const buf = Buffer.from(hbpContent, 'utf8');
const hexLines = [`HEX-HEADER|bytes=${buf.length}|sha16=${totalSha16}|wordWidth=16`];
for (let i = 0; i < buf.length; i += 32) {
  const c = buf.subarray(i, Math.min(i + 32, buf.length));
  hexLines.push(`HEX|offset=${i.toString(16).padStart(8, '0').toUpperCase()}|bytes=${c.toString('hex').toUpperCase()}`);
}
writeFileSync(hbpPath + '.hex', hexLines.join('\n') + '\n');

// .ing
const ingRows = [
  `INGREDIENTS|schema=HBPV1-INGREDIENTS-V1|target_sha=${totalSha16}|target_bytes=${buf.length}|target_rows=${rows.length}|emitted_at=${ts()}|simula_consensus_rank=4`,
  `EMITTER|name=D:/bigpickle-rebuild/fire-deep-wave-smoke-2026-05-28.mjs|vantage=acer|process_pid=${process.pid}|cascade=${CASCADE_ID}`,
  `AUTHORITY|SPECIAL-OP-JESSE-H12D3+FOUNDATION-V3-LAW+vote-LYMPHATIC+do-them-all`,
  `INPUTS|count=6|i0=src/deep-wave-decompose.mjs|i1=src/deep-wave-dispatcher.mjs|i2=src/deep-wave-integrate.mjs|i3=src/deep-wave-extended-integrate.mjs|i4=src/pid-chain-revolver.mjs|i5=src/hookwall.mjs`,
  `ALGO|deep-wave-smoke-fire|1_wave_${BEATS}_beats_${ROOMS}_rooms_${LANE_CYCLE.length}_lanes|expected_packets=${BEATS*ROOMS*LANE_CYCLE.length}`,
  `LAW-ANCHOR|LAW-1M-1E200+FOUNDATION-V3+7-lane-LYMPHATIC+AUTO-HEAL`,
  `DUAL-CRITIC-EXPECTED|critic_a_structural=pass|critic_b_statistical=pass|sycophancy_canary=acceptable`,
];
writeFileSync(hbpPath + '.ing', ingRows.join('\n') + '\n');

process.stdout.write(`DW-SMOKE-QUINTET-SEALED|sha=${totalSha16}|bytes=${buf.length}|rows=${rows.length}|path=${hbpPath.replace(/\\/g, '/')}\n`);
process.stdout.write(`DW-SMOKE-DONE|cascade=${CASCADE_ID}|wallClock_ms=${wallMs}|integration_rows_core=${intRows.length}|integration_rows_extended=${extRows.length}\n`);

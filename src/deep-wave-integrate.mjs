// Deep-Wave integration layer.
// Pipes deep-wave dispatcher output INTO every adjacent federation primitive.
// HBPv1 pipe-rows only (no JSON outputs). PID-specific throughout. Glyph-encoded.
//
// Targets:
//   - HyperBEHCS substrate (triple-quant: polar + turbo + JL + zeta)
//   - BEHCS-256 / BEHCS-1024 glyph alphabets
//   - Atlas voxel registration
//   - 3D map / Brown-Hilbert coord
//   - Memory-AI candidate row (canon-index format)
//   - Asolaria super-dashboard tile (HBPv1 pipe-row)
//   - Omnischeduler task PID
//   - Omnimets metric sample PID
//   - Omnirouter destination PID
//   - Quant engines (4 quants: polar/turbo/JL/zeta)
//   - Federation cue
//
// Each adapter returns a pipe-row string. No JSON.

import { createHash } from 'node:crypto';
import { glyphAt, BEHCS256, BEHCS1024 } from './behcs.mjs';
import { LANE_CYCLE } from './pid-chain-revolver.mjs';
import { decomposeBeat, beatLabel, WAVE_NAMES, PROTOCOL_NAMES, SURFACE_NAMES, DIMENSION_NAMES, BODY_NAMES } from './deep-wave-decompose.mjs';

function sha16(input) {
  return createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

// ============= BEHCS-256 / 1024 glyph =============

export function toBEHCS256Glyph({ pid, actor }) {
  const a = (actor !== undefined) ? actor : (parseInt(sha16(pid), 16) % 256);
  const glyph = glyphAt(a, 256);
  return `BEHCS256-GLYPH|pid=${pid}|actor=${a}|glyph=${glyph}|alphabet=256`;
}

export function toBEHCS1024Glyph({ pid, actor }) {
  const a = (actor !== undefined) ? actor : (parseInt(sha16(pid), 16) % 1024);
  const glyph = glyphAt(a, 1024);
  return `BEHCS1024-GLYPH|pid=${pid}|actor=${a}|glyph=${glyph}|alphabet=1024|subset_embed_256=${a < 256}`;
}

// ============= HyperBEHCS triple-quant =============

export function toHyperBEHCSTripleQuant({ pid, score, beatIdx }) {
  const h = createHash('sha256').update(pid).digest();
  // 4 quants — each a 16-bit slice of the sha mapped to [-1, 1]
  const polar = ((h.readUInt16BE(0) / 0xFFFF) - 0.5) * 2;
  const turbo = ((h.readUInt16BE(2) / 0xFFFF) - 0.5) * 2;
  const jl    = ((h.readUInt16BE(4) / 0xFFFF) - 0.5) * 2;
  const zeta  = ((h.readUInt16BE(6) / 0xFFFF) - 0.5) * 2;
  return `HYPERBEHCS-TQ|pid=${pid}|score=${score.toFixed(6)}|beat=${beatIdx}|polar=${polar.toFixed(4)}|turbo=${turbo.toFixed(4)}|JL=${jl.toFixed(4)}|zeta=${zeta.toFixed(4)}`;
}

// ============= Atlas voxel + 3D map (Brown-Hilbert) =============

// Map a (wave, protocol, surface, dimension, body, shannon) decomposition into a hilbert voxel triple.
// Per canon: 47D catalog with planned 50D; here we project to 3 coords for 3D map rendering.
export function toAtlasVoxel({ beatIdx, roomIdx, cascadeId }) {
  const d = decomposeBeat(beatIdx);
  // Voxel x = wave * 36 + protocol * 6 + body (range 0..215)
  // Voxel y = surface * 12 + shannon (range 0..71)
  // Voxel z = dimension * (roomIdx % 256) (range 0..1530)
  const x = d.wave * 36 + d.protocol * 6 + d.body;
  const y = d.surface * 12 + d.shannon;
  const z = d.dimension * (roomIdx % 256);
  const hilbert = sha16(`${cascadeId}|${beatIdx}|${roomIdx}|${x}|${y}|${z}`).slice(0, 12);
  return `ATLAS-VOXEL|cascade=${cascadeId}|beat=${beatIdx}|room=${roomIdx}|x=${x}|y=${y}|z=${z}|hilbert=${hilbert}`;
}

export function to3DMapPoint({ beatIdx, roomIdx }) {
  const d = decomposeBeat(beatIdx);
  const x = d.wave * 36 + d.protocol * 6 + d.body;
  const y = d.surface * 12 + d.shannon;
  const z = d.dimension * (roomIdx % 256);
  return `MAP-3D|beat=${beatIdx}|room=${roomIdx}|coord=${x},${y},${z}|dim_label=${WAVE_NAMES[d.wave]}/${PROTOCOL_NAMES[d.protocol]}/${SURFACE_NAMES[d.surface]}/${DIMENSION_NAMES[d.dimension]}/${BODY_NAMES[d.body]}`;
}

// ============= Memory-AI candidate row (canon-index format) =============

export function toMemoryAICandidate({ cascadeId, stats }) {
  const dt = new Date().toISOString().slice(0, 10);
  return `MEMORY-AI-CANDIDATE|class=Project|name=deep_wave_cascade_${cascadeId}_${dt}|memory_file=project_deep_wave_cascade_${cascadeId}_${dt}.md|total_packets=${stats.totalPackets}|genius=${stats.totalGenius}|mistake=${stats.totalMistake}|hookwall_pass_rate=${(stats.totalHookwallPass/stats.totalPackets*100).toFixed(2)}|lanes=${LANE_CYCLE.length}|chain_seal_pending=true`;
}

// ============= Super-Dashboard tile (HBPv1 pipe-row, NOT JSON) =============

export function toSuperDashboardTile({ cascadeId, waveIdx, stats }) {
  const ts = new Date().toISOString();
  return `DASHBOARD-TILE|cascade=${cascadeId}|wave=${waveIdx}|wave_name=${WAVE_NAMES[waveIdx]}|packets=${stats.totalPackets}|genius=${stats.totalGenius}|mistake=${stats.totalMistake}|hookwall_pass=${stats.totalHookwallPass}|hookwall_reject=${stats.totalHookwallReject}|avg_score=${stats.avgScore.toFixed(6)}|ts=${ts}`;
}

// ============= Omnischeduler task PID =============

export function toOmnischedulerTask({ cascadeId, waveIdx, beatStart, beatEnd, roomCount }) {
  const taskPid = sha16(`omnischeduler-task|${cascadeId}|w${waveIdx}|${beatStart}-${beatEnd}|rooms=${roomCount}`);
  return `OMNISCHEDULER-TASK|task_pid=${taskPid}|cascade=${cascadeId}|wave=${waveIdx}|beats=${beatStart}-${beatEnd}|rooms=${roomCount}|priority=normal|status=scheduled`;
}

// ============= Omnimets metric sample PID =============

export function toOmnimetsSample({ cascadeId, waveIdx, stats }) {
  const samplePid = sha16(`omnimets|${cascadeId}|w${waveIdx}|${stats.totalPackets}`);
  return `OMNIMETS-SAMPLE|sample_pid=${samplePid}|cascade=${cascadeId}|wave=${waveIdx}|metric=packets_per_wave|value=${stats.totalPackets}|metric=genius_rate|value=${(stats.totalGenius/stats.totalPackets).toFixed(6)}|metric=mistake_rate|value=${(stats.totalMistake/stats.totalPackets).toFixed(6)}|metric=avg_score|value=${stats.avgScore.toFixed(6)}`;
}

// ============= Omnirouter destination PID =============

export function toOmnirouterDest({ cascadeId, waveIdx, packet }) {
  // Destination determined by lane + body dimension
  const dest = `lane:${packet.lane}|body:${BODY_NAMES[packet.beatDecomposed.body]}`;
  const routePid = sha16(`omnirouter|${cascadeId}|w${waveIdx}|${packet.pid}|${dest}`);
  return `OMNIROUTER-DEST|route_pid=${routePid}|src_pid=${packet.pid}|cascade=${cascadeId}|wave=${waveIdx}|dest=${dest}`;
}

// ============= Quant engines (4 quants composite) =============

export function toQuantEnginesComposite({ pid, score, beatIdx }) {
  const tq = toHyperBEHCSTripleQuant({ pid, score, beatIdx });
  // Decode the quant values from the row
  const m = tq.match(/polar=([-.\d]+)\|turbo=([-.\d]+)\|JL=([-.\d]+)\|zeta=([-.\d]+)/);
  const [, p, t, j, z] = m;
  const norm = Math.sqrt(p*p + t*t + j*j + z*z).toFixed(4);
  const composite_pid = sha16(`quant-composite|${pid}|${p}|${t}|${j}|${z}`);
  return `QUANT-COMPOSITE|pid=${composite_pid}|src_pid=${pid}|polar=${p}|turbo=${t}|JL=${j}|zeta=${z}|L2_norm=${norm}|engines=polar+turbo+JL+zeta`;
}

// ============= Federation cue =============

export function toFederationCue({ cascadeId, waveIdx, vantage = 'acer', stats }) {
  const cuePid = sha16(`federation-cue|${vantage}|${cascadeId}|w${waveIdx}|${stats.totalPackets}`);
  return `FEDERATION-CUE|cue_pid=${cuePid}|vantage=${vantage}|cascade=${cascadeId}|wave=${waveIdx}|packets=${stats.totalPackets}|genius=${stats.totalGenius}|mistake=${stats.totalMistake}|broadcast_targets=acer+liris+falcon+felipe+beast+gpt+google-antigravity+symphony+auggie`;
}

// ============= Full integration emit per wave =============

export function emitFullIntegrationRows({ cascadeId, waveIdx, stats, samplePacket }) {
  const rows = [];
  rows.push(toOmnischedulerTask({ cascadeId, waveIdx, beatStart: stats.beatRange[0], beatEnd: stats.beatRange[1], roomCount: stats.rooms_count }));
  rows.push(toOmnimetsSample({ cascadeId, waveIdx, stats }));
  rows.push(toFederationCue({ cascadeId, waveIdx, stats }));
  rows.push(toMemoryAICandidate({ cascadeId, stats }));
  rows.push(toSuperDashboardTile({ cascadeId, waveIdx, stats }));
  if (samplePacket) {
    rows.push(toBEHCS256Glyph({ pid: samplePacket.pid }));
    rows.push(toBEHCS1024Glyph({ pid: samplePacket.pid }));
    rows.push(toHyperBEHCSTripleQuant({ pid: samplePacket.pid, score: samplePacket.score, beatIdx: samplePacket.beatIdx }));
    rows.push(toAtlasVoxel({ beatIdx: samplePacket.beatIdx, roomIdx: samplePacket.roomIdx, cascadeId }));
    rows.push(to3DMapPoint({ beatIdx: samplePacket.beatIdx, roomIdx: samplePacket.roomIdx }));
    rows.push(toOmnirouterDest({ cascadeId, waveIdx, packet: samplePacket }));
    rows.push(toQuantEnginesComposite({ pid: samplePacket.pid, score: samplePacket.score, beatIdx: samplePacket.beatIdx }));
  }
  return rows;
}

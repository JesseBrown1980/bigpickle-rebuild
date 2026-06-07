// Feed the 1e200 + million-PID-packet-run blast results through the substrate:
// - top genius marks, top mistake marks, summary stats
// - glyphed into BEHCS-256 / 1024 / HyperBEHCS NDJSON
// - cosign-sealed via durableNotify (liris daemon catches)

import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

const SUMMARY_PATH = 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/million-run/real-agent-gnn-summary-latest.json';
const GENIUS_PATH = 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/million-run/genius-real-agent-marks-latest.ndjson';
const MISTAKE_PATH = 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/million-run/mistake-real-agent-marks-latest.ndjson';

const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
const geniusLines = fs.readFileSync(GENIUS_PATH, 'utf8').trim().split('\n');
const mistakeLines = fs.readFileSync(MISTAKE_PATH, 'utf8').trim().split('\n');

// Take top 5 of each by score / reverseGain
function topN(lines, n, scoreField) {
  return lines.slice(0, 1000)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (b[scoreField] || 0) - (a[scoreField] || 0))
    .slice(0, n);
}
const topGenius = topN(geniusLines, 5, 'score');
const topMistakes = topN(mistakeLines, 5, 'reverseGain');

// BEHCS glyphing: cp band by alphabet (256 = small set, 1024 = full BH range, hyperbehcs = beyond)
function glyphTier(idx, layerName) {
  if (layerName === '256') return idx % 256;
  if (layerName === '1024') return idx % 1024;
  return (idx * 7) % 4096; // hyperbehcs spread
}

const FWD = `C:/Users/acer/Asolaria/data/behcs/gnn-feeds/blast-1e200-million-run-edges-latest.ndjson`;
const REV = `C:/Users/acer/Asolaria/data/behcs/shannon/blast-1e200-million-run-symbols-latest.ndjson`;
const HBEHCS_256 = `C:/Users/acer/Asolaria/data/behcs/cubes/blast-glyph-256-latest.ndjson`;
const HBEHCS_1024 = `C:/Users/acer/Asolaria/data/behcs/cubes/blast-glyph-1024-latest.ndjson`;
const HBEHCS_HYPER = `C:/Users/acer/Asolaria/data/behcs/cubes/blast-glyph-hyperbehcs-latest.ndjson`;

const fwdLines = [], revLines = [], g256 = [], g1024 = [], gHyper = [];

let nodeIdx = 0;
for (const m of topGenius) {
  const cp = 700 + (nodeIdx * 7) % 200; // forge band 720-799 ish
  const bh = hilbertEncode([(cp >> 0) & 0xf, (cp >> 4) & 0xf, (cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const node = `blast:genius:${m.lane || m.id || nodeIdx}`;
  fwdLines.push(JSON.stringify({ schema: 'asolaria.os.blast_1e200_million.edge.v1', from: node, to: `cube:cp${cp}-bh${bh}`, relation: 'million_run_genius_mark', weight: m.score || 0.9, lane: m.lane, score: m.score, cp, direction: 'forward', ts_iso: new Date().toISOString() }));
  revLines.push(JSON.stringify({ schema: 'asolaria.os.blast_1e200_million.symbol.v1', symbol: `blast-genius-${nodeIdx}`, finding_node: node, kind: 'genius', weight: m.score || 0.9, summary: m.summary || '', ts_iso: new Date().toISOString() }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: glyphTier(nodeIdx, '256'), node, kind: 'genius', score: m.score }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: glyphTier(nodeIdx, '1024'), node, kind: 'genius', cp, bh_3d: bh }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: glyphTier(nodeIdx, 'hyper'), node, kind: 'genius', cp, bh_3d: bh, layer_note: 'after-loss-recovery-canon' }));
  nodeIdx++;
}
for (const m of topMistakes) {
  const cp = 850 + (nodeIdx * 11) % 50; // falcon band 800-895
  const bh = hilbertEncode([(cp >> 0) & 0xf, (cp >> 4) & 0xf, (cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const node = `blast:mistake:${m.lane || m.id || nodeIdx}`;
  fwdLines.push(JSON.stringify({ schema: 'asolaria.os.blast_1e200_million.edge.v1', from: node, to: `cube:cp${cp}-bh${bh}`, relation: 'million_run_mistake_mark', weight: m.reverseGain || 0.9, lane: m.lane, reverseGain: m.reverseGain, cp, direction: 'forward', ts_iso: new Date().toISOString() }));
  revLines.push(JSON.stringify({ schema: 'asolaria.os.blast_1e200_million.symbol.v1', symbol: `blast-mistake-${nodeIdx}`, finding_node: node, kind: 'mistake', reverseGain: m.reverseGain, summary: m.summary || '', ts_iso: new Date().toISOString() }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: glyphTier(nodeIdx, '256'), node, kind: 'mistake', reverseGain: m.reverseGain }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: glyphTier(nodeIdx, '1024'), node, kind: 'mistake', cp, bh_3d: bh }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: glyphTier(nodeIdx, 'hyper'), node, kind: 'mistake', cp, bh_3d: bh }));
  nodeIdx++;
}

for (const [p, lines] of [[FWD, fwdLines], [REV, revLines], [HBEHCS_256, g256], [HBEHCS_1024, g1024], [HBEHCS_HYPER, gHyper]]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

const redis = new RedisBridge({
  host: '127.0.0.1', port: 6379, vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await redis.connect(); await redis.auth();
const ch = channelFor('acer', 'blast', '1e200-million-run-results');

// Summary-level seal
const r = await durableNotify(ch, {
  event: 'blast-1e200-million-run-complete',
  vantage: 'acer', wave: 'W20-QQ', layer: 9,
  status: summary.status,
  counts: summary.counts,
  elapsed_ms: summary.elapsedMs,
  top_genius_count: topGenius.length,
  top_mistake_count: topMistakes.length,
  top_genius_lanes: topGenius.map(g => g.lane || g.id),
  top_mistake_lanes: topMistakes.map(m => m.lane || m.id),
  glyphed_into: ['BEHCS-256', 'BEHCS-1024', 'HyperBEHCS'],
  feed_files: { fwd_gnn: FWD, rev_shannon: REV, glyph_256: HBEHCS_256, glyph_1024: HBEHCS_1024, glyph_hyper: HBEHCS_HYPER },
  safety_modes: summary.mode,
}, redis);
console.log('SUMMARY SEAL: cosign seq=' + r.cosign.seq + ' subs=' + r.publish.subscribers);

console.log('');
console.log('=== TOP 5 GENIUS MARKS ===');
for (const g of topGenius) console.log(`[score=${(g.score||0).toFixed(3)}] ${g.lane || g.id} — ${(g.summary || '').slice(0,70)}`);
console.log('');
console.log('=== TOP 5 MISTAKE MARKS ===');
for (const m of topMistakes) console.log(`[rg=${(m.reverseGain||0).toFixed(3)}] ${m.lane || m.id} — ${(m.summary || '').slice(0,70)}`);
console.log('');
console.log(JSON.stringify({
  blast_genius_marks: summary.counts.geniusMarks,
  blast_mistake_marks: summary.counts.mistakeMarks,
  blast_real_tasks: summary.counts.realLowerLevelAgentTasksExecuted,
  blast_elapsed_ms: summary.elapsedMs,
  blast_throughput_per_sec: Math.round(summary.counts.realLowerLevelAgentTasksExecuted / (summary.elapsedMs / 1000)),
  child_process_spawns: summary.counts.childProcessSpawns,
  external_model_tokens: summary.counts.externalModelTokens,
  fed_to_fabric: { fwd_edges: fwdLines.length, rev_symbols: revLines.length, glyph_256: g256.length, glyph_1024: g1024.length, glyph_hyper: gHyper.length },
  cosign_seq: r.cosign.seq,
  liris_daemon_caught: r.publish.subscribers === 1,
}, null, 2));
redis.close();

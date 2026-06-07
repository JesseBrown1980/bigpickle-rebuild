import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

const SUMMARY = JSON.parse(fs.readFileSync('C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/100b-run/real-100b-gnn-summary-latest.json', 'utf8'));
const GENIUS_FARM = fs.readFileSync('C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/100b-run/genius-farm-latest.ndjson', 'utf8').trim().split('\n').filter(l => l).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const MISTAKE_FARM = fs.readFileSync('C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/100b-run/mistake-farm-latest.ndjson', 'utf8').trim().split('\n').filter(l => l).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const topGenius = GENIUS_FARM.slice(0, 5);
const topMistakes = MISTAKE_FARM.slice(0, 5);

const FWD = 'C:/Users/acer/Asolaria/data/behcs/gnn-feeds/blast-100b-combined-edges-latest.ndjson';
const REV = 'C:/Users/acer/Asolaria/data/behcs/shannon/blast-100b-combined-symbols-latest.ndjson';
const G256 = 'C:/Users/acer/Asolaria/data/behcs/cubes/blast-100b-glyph-256-latest.ndjson';
const G1024 = 'C:/Users/acer/Asolaria/data/behcs/cubes/blast-100b-glyph-1024-latest.ndjson';
const GHYPER = 'C:/Users/acer/Asolaria/data/behcs/cubes/blast-100b-glyph-hyperbehcs-latest.ndjson';

const fwd = [], rev = [], g256 = [], g1024 = [], gHyper = [];
let i = 0;
for (const m of [...topGenius, ...topMistakes]) {
  const isGenius = i < topGenius.length;
  const cp = isGenius ? 720 + (i * 7) % 80 : 850 + ((i - topGenius.length) * 11) % 45;
  const bh = hilbertEncode([(cp >> 0) & 0xf, (cp >> 4) & 0xf, (cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const node = `blast-100b:${isGenius ? 'genius' : 'mistake'}:${m.lane || m.id || i}`;
  fwd.push(JSON.stringify({ schema: 'asolaria.os.blast_100b_combined.edge.v1', from: node, to: 'cube:cp' + cp + '-bh' + bh, relation: '100b_run_' + (isGenius ? 'genius_mark' : 'mistake_mark'), weight: m.score || m.reverseGain || 0.9, lane: m.lane, cp, ts_iso: new Date().toISOString() }));
  rev.push(JSON.stringify({ schema: 'asolaria.os.blast_100b_combined.symbol.v1', symbol: 'blast-100b-' + (isGenius ? 'g' : 'm') + '-' + i, finding_node: node, kind: isGenius ? 'genius' : 'mistake', weight: m.score || m.reverseGain || 0.9, summary: (m.summary || '').slice(0, 100), ts_iso: new Date().toISOString() }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: i % 256, node, kind: isGenius ? 'genius' : 'mistake' }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: i % 1024, node, cp, bh_3d: bh }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: (i * 7) % 4096, node, cp, bh_3d: bh, layer_note: 'combined-1e200-INDEX-plus-100b-flow' }));
  i++;
}
for (const [p, lines] of [[FWD, fwd], [REV, rev], [G256, g256], [G1024, g1024], [GHYPER, gHyper]]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

const redis = new RedisBridge({ host: '127.0.0.1', port: 6379, vantage: 'acer', bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98' });
await redis.connect(); await redis.auth();
const r = await durableNotify(channelFor('acer', 'blast', '100b-combined-1e200-INDEX'), {
  event: 'blast-100b-combined-1e200-INDEX-tranche-done',
  vantage: 'acer', wave: 'W20-QQ', layer: 10,
  status: SUMMARY.status,
  progress_pct: SUMMARY.progressPercent,
  target_packets: SUMMARY.mode.targetPackets,
  tranche_packets: SUMMARY.adaptiveFeedback?.recommendedTranchePackets,
  elapsed_ms: SUMMARY.elapsedMs,
  cumulative_genius_farm_count: GENIUS_FARM.length,
  cumulative_mistake_farm_count: MISTAKE_FARM.length,
  top_genius_lanes: topGenius.map(g => g.lane || g.id),
  top_mistake_lanes: topMistakes.map(m => m.lane || m.id),
  glyphed_into: ['BEHCS-256', 'BEHCS-1024', 'HyperBEHCS'],
  safety: SUMMARY.mode,
}, redis);
console.log('SEAL: cosign seq=' + r.cosign.seq + ' subs=' + r.publish.subscribers);
console.log('');
console.log('=== TOP 5 GENIUS (cumulative 100B farm) ===');
for (const g of topGenius) console.log('[' + (g.score || g.weight || '?') + '] ' + (g.lane || g.id) + ' -- ' + (g.summary || '').slice(0, 80));
console.log('');
console.log('=== TOP 5 MISTAKE (cumulative 100B farm) ===');
for (const m of topMistakes) console.log('[' + (m.reverseGain || m.score || '?') + '] ' + (m.lane || m.id) + ' -- ' + (m.summary || '').slice(0, 80));
console.log('');
console.log(JSON.stringify({
  status: SUMMARY.status,
  progress_pct: SUMMARY.progressPercent,
  target_packets: SUMMARY.mode.targetPackets,
  tranche_packets: SUMMARY.adaptiveFeedback?.recommendedTranchePackets,
  tranche_throughput_per_sec: Math.round((SUMMARY.adaptiveFeedback?.recommendedTranchePackets || 0) / (SUMMARY.elapsedMs / 1000)),
  cumulative_genius: GENIUS_FARM.length,
  cumulative_mistake: MISTAKE_FARM.length,
  cosign_seq: r.cosign.seq,
  liris_caught: r.publish.subscribers === 1,
  glyphed_rows_per_layer: 10,
}, null, 2));
redis.close();

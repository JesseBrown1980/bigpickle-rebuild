// Ask all 33 supervisor sets about GNN models in archaeology / history / asolaria
// using fabric-thinker.fireBatch → descriptor + cosign + redis
// Aggregate descriptor outputs as supervisor "votes" on the GNN-archaeology question.

import { loadPidIndex, fireBatch } from './src/fabric-thinker.mjs';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import fs from 'node:fs';

// Also probe filesystem for ALL GNN historical artifacts
const GNN_HISTORICAL_DIRS = [
  '/c/Users/acer/Asolaria/services/gnn-sidecar/models',
  '/c/Users/acer/Asolaria/sovereignty/research/gnn-patterns/models',
  '/c/Users/acer/Asolaria/dist/public-release/Asolaria-Public-20260410-093155/services/gnn-sidecar/models',
  '/c/Users/acer/Asolaria/quarantine',
  '/c/Users/acer/Asolaria/archives',
  '/c/HyperBEHCS/store',
];

function listGnnArchaeology() {
  const found = [];
  for (const d of GNN_HISTORICAL_DIRS) {
    try {
      const w = String(d).replace(/^\/c\//, 'C:/').replace(/^\/d\//, 'D:/');
      if (!fs.existsSync(w)) continue;
      const recurse = (dir, depth = 0) => {
        if (depth > 3) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = `${dir}/${ent.name}`;
          if (ent.isDirectory()) recurse(full, depth + 1);
          else if (/gnn/i.test(ent.name)) found.push({ path: full, name: ent.name });
        }
      };
      recurse(w);
    } catch {}
  }
  return found;
}

const gnnArtifacts = listGnnArchaeology();
console.log('=== GNN ARCHAEOLOGY: found', gnnArtifacts.length, 'artifacts ===');
const modelFiles = gnnArtifacts.filter(a => /\.(py|mjs|js|cjs|cube\.js)$/.test(a.name));
console.log('=== GNN MODEL CODE FILES (', modelFiles.length, ') ===');
const uniqueModelNames = new Set(modelFiles.map(m => m.name));
for (const n of uniqueModelNames) console.log('  -', n);

const pidLoad = loadPidIndex();
if (!pidLoad.ok) { console.error('PID load failed:', pidLoad.reason); process.exit(1); }
console.log('');
console.log('=== ASKING', pidLoad.count, 'SUPERVISORS ===');

const redis = new RedisBridge({
  host: '127.0.0.1', port: 6379, vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await redis.connect(); await redis.auth();

const QUERY = `which GNN models in archaeology and history serve this supervisor set and what is their canonical role`;
const result = await fireBatch(
  pidLoad.supervisors,
  (sup, i) => `${QUERY} | supervisor=${sup.pid} | cube=${sup.cube ?? ''}`,
  redis,
  durableNotify,
  { channel: 'omni-asolaria/acer/cube-catalog/supervisors-on-gnn-archaeology' }
);

// Aggregate descriptor outcomes by HIT/FALLBACK + by cp-band
const byPath = { HIT: 0, FALLBACK: 0 };
const byBand = {};
const topByCp = result.batch_stats.count > 0 ? [] : [];
for (let i = 0; i < result.seals.length; i++) {
  const sup = pidLoad.supervisors[i];
  const seal = result.seals[i];
  if (seal.error) continue;
  // We don't have per-outcome descriptor objects here (fireBatch wraps them);
  // but the seal carries cosign_seq which proves the descriptor was emitted.
}

console.log('');
console.log('=== BATCH RESULT ===');
console.log(JSON.stringify({
  supervisors_queried: result.batch_stats.count,
  descriptor_hits: result.batch_stats.hits,
  descriptor_hit_rate: result.batch_stats.hit_rate,
  descriptor_elapsed_ms: result.batch_stats.descriptor_elapsed_ms,
  cosign_seqs: result.seals.map(s => s.cosign_seq).filter(Boolean),
  fail_count: result.fail_count,
  fail_rate: result.fail_rate,
}, null, 2));

console.log('');
console.log('=== FIRST 10 SEALS (supervisor → cosign receipt) ===');
for (let i = 0; i < Math.min(10, result.seals.length); i++) {
  const sup = pidLoad.supervisors[i];
  const seal = result.seals[i];
  console.log(`[${sup.pid.slice(0,40).padEnd(40)}] seq=${seal.cosign_seq ?? 'FAIL'} subs=${seal.subscribers ?? '-'}`);
}

console.log('');
console.log('=== UNIQUE GNN MODEL CODE FILES INDEXED ===');
console.log([...uniqueModelNames].sort().join('\n'));

redis.close();

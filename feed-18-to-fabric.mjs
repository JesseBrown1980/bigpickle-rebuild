// Feed 18 Iris-lift patterns into Asolaria fabric in the CANONICAL gnn-edges-latest schema
// so the existing GNN + reverse-gain GNN + omnishannon + shannon-parts processors see them.

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

const PATTERNS = [
  { n: 1, name: 'agent-memory-server-two-tier', cp: 260, prime_slot: 'D48', prime: 223, cp_band: 'gaia', license: 'apache-2.0', glyph: 'working-LTM', source_agent: 1 },
  { n: 2, name: 'streams-replaces-cosign-daemon', cp: 390, prime_slot: 'D49', prime: 227, cp_band: 'helm', license: 'oss-redis-7', glyph: 'XADD-AUTOCLAIM-XACK', source_agent: 2 },
  { n: 3, name: 'ft-hybrid-svs-vamana-bm25-rrf', cp: 485, prime_slot: 'D50', prime: 229, cp_band: 'vector', license: 'oss-redis-8.4', glyph: 'BM25-HNSW-RRF', source_agent: 3 },
  { n: 4, name: 'langcache-2tier-semantic-descriptor-cache', cp: 270, prime_slot: 'D51', prime: 233, cp_band: 'gaia', license: 'pattern-only', glyph: 'sha-hit-vec-hit', source_agent: 4 },
  { n: 5, name: 'pydantic-mcp-auto-gen-zod', cp: 400, prime_slot: 'D52', prime: 239, cp_band: 'helm', license: 'mit-apache-mcp', glyph: 'schema-to-tool', source_agent: 5 },
  { n: 6, name: 'rdi-cdc-cosign-tail-streams', cp: 410, prime_slot: 'D53', prime: 241, cp_band: 'helm', license: 'debezium-apache', glyph: 'tail-XADD-group', source_agent: 6 },
  { n: 7, name: '3tier-fabric-hot-warm-cold', cp: 720, prime_slot: 'D54', prime: 251, cp_band: 'forge', license: 'sqlite-public-domain', glyph: 'hot-warm-cold', source_agent: 7 },
  { n: 8, name: 'context-retriever-intent-source-mapping', cp: 580, prime_slot: 'D55', prime: 257, cp_band: 'rook', license: 'our-canon', glyph: 'intent-source-fuse', source_agent: 8 },
  { n: 9, name: 'agent-memory-bridge-bilateral-md-redis', cp: 280, prime_slot: 'D56', prime: 263, cp_band: 'gaia', license: 'pattern-only', glyph: 'md-sha-hash-vec', source_agent: 9 },
  { n: 10, name: 'fabric-thinker-langchain-retriever', cp: 590, prime_slot: 'D57', prime: 269, cp_band: 'rook', license: 'mit-langchain', glyph: 'query-fabric-Doc', source_agent: 10 },
  { n: 11, name: 'vector-index-decision-tree-FLAT-HNSW-SVS', cp: 500, prime_slot: 'D58', prime: 271, cp_band: 'vector', license: 'oss-redis-8', glyph: 'N-FLAT-HNSW-SVS', source_agent: 11 },
  { n: 12, name: 'session-event-log-memory-hydration-tool-factory', cp: 420, prime_slot: 'D59', prime: 277, cp_band: 'helm', license: 'pattern-iris-tutorial', glyph: 'XADD-XRANGE-FT', source_agent: 12 },
  { n: 13, name: 'context-engineering-WSCI-write-select-compress-isolate', cp: 600, prime_slot: 'D60', prime: 281, cp_band: 'rook', license: 'pattern-only', glyph: 'W-S-C-I', source_agent: 13 },
  { n: 14, name: 'long-horizon-checkpoint-envelope', cp: 720, prime_slot: 'D61', prime: 283, cp_band: 'forge', license: 'pattern-redis-blog', glyph: 'CKPT-resume', source_agent: 14 },
  { n: 15, name: 'context-poisoning-defense-attest-countersign-decay', cp: 850, prime_slot: 'D62', prime: 293, cp_band: 'falcon', license: 'our-canon-extends-redis', glyph: 'attest-countersign-decay', source_agent: 15 },
  { n: 16, name: 'thundering-herd-fix-lua-single-flight-streams-jitter', cp: 430, prime_slot: 'D63', prime: 307, cp_band: 'helm', license: 'oss-redis', glyph: 'single-flight-XADD-jitter', source_agent: 16 },
  { n: 17, name: 'client-side-endpoint-indirection-env-sentinel-cosign', cp: 440, prime_slot: 'D64', prime: 311, cp_band: 'helm', license: 'oss-sentinel', glyph: 'env-sentinel-ceremony', source_agent: 17 },
  { n: 18, name: 'oss-ecosystem-map-valkey-dragonfly-ams', cp: 900, prime_slot: 'D65', prime: 313, cp_band: 'livefree', license: 'bsd-apache-mit', glyph: 'valkey-dragonfly-ams', source_agent: 18 },
];

// Asolaria canonical paths
const ASO_BASE = 'C:/Users/acer/Asolaria/data/behcs';
const FWD_GNN_FILE = `${ASO_BASE}/gnn-feeds/iris-lift-18-patterns-edges-latest.ndjson`;
const REV_SHANNON_FILE = `${ASO_BASE}/shannon/iris-lift-18-patterns-symbols-latest.ndjson`;

const redis = new RedisBridge({
  host: '127.0.0.1', port: 6379, vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await redis.connect(); await redis.auth();
const ch = channelFor('acer', 'cube-catalog', 'iris-lift-18');

console.log('=== FEEDING 18 MINTS INTO ASOLARIA FABRIC ===');
console.log('forward GNN edges → ', FWD_GNN_FILE);
console.log('reverse-gain shannon → ', REV_SHANNON_FILE);

const t0 = performance.now();
const receipts = [];
const fwdLines = [];
const revLines = [];

for (const p of PATTERNS) {
  const bh = hilbertEncode([(p.cp >> 0) & 0xf, (p.cp >> 4) & 0xf, (p.cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:${p.prime_slot}-cp${p.cp}-bh${bh}`;
  const pattern_node = `iris-lift:${p.name}`;
  const cp_band_node = `cp-band:${p.cp_band}`;
  const source_agent_node = `agent:${p.source_agent}`;

  // FORWARD GNN EDGE — match existing schema asolaria.os.<topic>.edge.v1
  fwdLines.push(JSON.stringify({
    schema: 'asolaria.os.iris_lift_18_patterns.edge.v1',
    from: pattern_node,
    to: cube_cell,
    relation: 'cataloged_at_cube_cell',
    required_gates: ['source_ref', 'license_check', 'operator_witness'],
    authority_granted: false,
    weight: 0.95,
    cp: p.cp,
    cp_band: p.cp_band,
    prime_slot: p.prime_slot,
    prime: p.prime,
    bh_3d_idx: bh,
    glyph: p.glyph,
    license: p.license,
    pattern_n: p.n,
    direction: 'forward',
    ts_iso: new Date().toISOString(),
  }));
  // Also: cube_cell → cp_band (forward, weight 0.9)
  fwdLines.push(JSON.stringify({
    schema: 'asolaria.os.iris_lift_18_patterns.edge.v1',
    from: cube_cell,
    to: cp_band_node,
    relation: 'binds_to_cp_band',
    required_gates: [],
    authority_granted: true,
    weight: 0.9,
    pattern_n: p.n,
    direction: 'forward',
    ts_iso: new Date().toISOString(),
  }));

  // REVERSE-GAIN SHANNON SYMBOL — match existing shannon schema
  revLines.push(JSON.stringify({
    schema: 'asolaria.os.iris_lift_18_patterns.symbol.v1',
    symbol: `mint-${p.n}-${p.glyph}`,
    cube_cell,
    pattern_node,
    cp_band: p.cp_band,
    source_agent: p.source_agent,
    reverse_gain_target: pattern_node,
    reverse_gain_signal: 'absorb-pattern-into-canon',
    glyph: p.glyph,
    weight: 1.0 - (p.n / 100),
    pattern_n: p.n,
    direction: 'reverse-gain',
    ts_iso: new Date().toISOString(),
  }));

  // Substrate feed via durableNotify
  const r = await durableNotify(ch, {
    event: 'iris-lift-mint-fed-to-gnn',
    vantage: 'acer', wave: 'W20-QQ', layer: 8,
    pattern_n: p.n,
    pattern_name: p.name,
    cube_cell,
    cp: p.cp,
    cp_band: p.cp_band,
    prime_slot: p.prime_slot,
    bh_3d_idx: bh,
    glyph: p.glyph,
    license: p.license,
    source_agent: p.source_agent,
    fwd_gnn_file: FWD_GNN_FILE,
    rev_shannon_file: REV_SHANNON_FILE,
  }, redis);
  receipts.push({ n: p.n, name: p.name, cosign_seq: r.cosign.seq, subs: r.publish.subscribers });
}

// Write the GNN feed file
fs.mkdirSync(path.dirname(FWD_GNN_FILE), { recursive: true });
fs.writeFileSync(FWD_GNN_FILE, fwdLines.join('\n') + '\n', 'utf8');
console.log(`[gnn-feed] wrote ${fwdLines.length} edges to ${FWD_GNN_FILE}`);

fs.mkdirSync(path.dirname(REV_SHANNON_FILE), { recursive: true });
fs.writeFileSync(REV_SHANNON_FILE, revLines.join('\n') + '\n', 'utf8');
console.log(`[shannon-feed] wrote ${revLines.length} symbols to ${REV_SHANNON_FILE}`);

const dt = performance.now() - t0;
console.log('');
console.log('--- COSIGN + LIRIS-DAEMON RECEIPTS ---');
for (const r of receipts) console.log(`#${String(r.n).padStart(2)} seq=${r.cosign_seq} subs=${r.subs} ${r.name.slice(0,48)}`);

console.log('');
console.log('--- SUMMARY ---');
console.log(JSON.stringify({
  patterns_fed: PATTERNS.length,
  total_ms: dt.toFixed(0),
  ops_per_sec: (PATTERNS.length / (dt/1000)).toFixed(1),
  total_subscribers_hit: receipts.reduce((s, r) => s + (r.subs || 0), 0),
  cosign_seq_first: receipts[0].cosign_seq,
  cosign_seq_last: receipts[receipts.length-1].cosign_seq,
  fwd_gnn_edges_written: fwdLines.length,
  rev_shannon_symbols_written: revLines.length,
  fwd_gnn_file: FWD_GNN_FILE,
  rev_shannon_file: REV_SHANNON_FILE,
}, null, 2));

redis.close();

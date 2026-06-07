// Map all 139 asolaria-profile surfaces into the newer bigpickle-rebuild substrate.
// Each surface gets: cube cell + cp band + bh_3d + glyph + cosign hop + redis publish
// + NDJSON rows in BEHCS-256 / 1024 / HyperBEHCS layers + forward GNN edge + reverse-gain symbol.
//
// Mapping is METADATA ONLY — no vault content is read. RESTRICTED tier surfaces are
// cataloged by their resolver row, not their target path.

import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

const PROFILE_PATH = 'C:/HyperBEHCS/store/asolaria-profile-index.hbp';
const txt = fs.readFileSync(PROFILE_PATH, 'utf8');
const surfaces = [];
for (const line of txt.split('\n').filter(l => l.startsWith('APROFSURFACE'))) {
  const kv = {};
  for (const part of line.split('|')) {
    const i = part.indexOf('=');
    if (i > 0) kv[part.slice(0, i)] = part.slice(i + 1);
  }
  if (kv.surface_id) surfaces.push(kv);
}
console.log('Loaded', surfaces.length, 'surfaces from', PROFILE_PATH);

// Asolaria GNN feed canonical paths
const ASO = 'C:/Users/acer/Asolaria/data/behcs';
const FWD = `${ASO}/gnn-feeds/asolaria-profile-139-surfaces-edges-latest.ndjson`;
const REV = `${ASO}/shannon/asolaria-profile-139-surfaces-symbols-latest.ndjson`;
const G256 = `${ASO}/cubes/asolaria-profile-139-glyph-256-latest.ndjson`;
const G1024 = `${ASO}/cubes/asolaria-profile-139-glyph-1024-latest.ndjson`;
const GHYPER = `${ASO}/cubes/asolaria-profile-139-glyph-hyperbehcs-latest.ndjson`;

// Per-surface mapping
function tierToCpBand(tier) {
  if (tier === 'RESTRICTED') return 800; // falcon band — restricted/sentinel
  if (tier === 'PUBLIC') return 480;     // vector band — public/discoverable
  return 256;                            // gaia band — unknown/fallback
}

function kindToCpOffset(kind) {
  const map = {
    'canon-file': 5, 'vault-inventory': 50, 'auth-chain': 20, 'citizen-stub': 10,
    'engine': 30, 'profile': 15, 'manifest': 25, 'index': 8, 'spec': 12,
  };
  return map[kind] || (Array.from(kind || '').reduce((s, c) => s + c.charCodeAt(0), 0) % 80);
}

const fwdLines = [], revLines = [], g256 = [], g1024 = [], gHyper = [];

let i = 0;
for (const s of surfaces) {
  const cpBase = tierToCpBand(s.access_tier);
  const cp = cpBase + kindToCpOffset(s.kind);
  const bh = hilbertEncode([(cp >> 0) & 0xf, (cp >> 4) & 0xf, (cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:asolaria-prof-cp${cp}-bh${bh}`;
  const node = `aso-surface:${s.surface_id}`;

  fwdLines.push(JSON.stringify({
    schema: 'asolaria.os.profile_139_surfaces.edge.v1',
    from: node, to: cube_cell,
    relation: 'mapped_into_newer_substrate',
    required_gates: s.access_tier === 'RESTRICTED' ? ['quintuple_cosign_ring'] : [],
    authority_granted: s.access_tier === 'PUBLIC',
    weight: s.access_tier === 'RESTRICTED' ? 1.0 : 0.85,
    surface_id: s.surface_id, kind: s.kind, access_tier: s.access_tier,
    sha8: (s.sha || '').slice(0, 12),
    cp, surface_n: i,
    ts_iso: new Date().toISOString(),
  }));
  revLines.push(JSON.stringify({
    schema: 'asolaria.os.profile_139_surfaces.symbol.v1',
    symbol: `aso-surf-${i}-${s.surface_id}`,
    cube_cell, finding_node: node,
    kind: s.kind, access_tier: s.access_tier,
    weight: s.access_tier === 'RESTRICTED' ? 1.0 : 0.85,
    description: (s.description || '').slice(0, 100),
    ts_iso: new Date().toISOString(),
  }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: i % 256, node, kind: s.kind, tier: s.access_tier }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: i % 1024, node, cp, bh_3d: bh, tier: s.access_tier }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: (i * 7) % 4096, node, cp, bh_3d: bh, surface_path: s.path || null }));
  i++;
}

for (const [p, lines] of [[FWD, fwdLines], [REV, revLines], [G256, g256], [G1024, g1024], [GHYPER, gHyper]]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

const redis = new RedisBridge({
  host: '127.0.0.1', port: 6379, vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await redis.connect(); await redis.auth();
const ch = channelFor('acer', 'asolaria-profile', '139-mapped-to-newer-system');

// Single SUMMARY seal (not 139 individual seals — would burn cosign daemon budget)
const r = await durableNotify(ch, {
  event: 'asolaria-profile-139-surfaces-mapped-to-newer-substrate',
  vantage: 'acer', wave: 'W20-QQ', layer: 11,
  total_surfaces: surfaces.length,
  by_tier: surfaces.reduce((a, s) => { a[s.access_tier || 'UNK'] = (a[s.access_tier || 'UNK'] || 0) + 1; return a; }, {}),
  by_kind: surfaces.reduce((a, s) => { a[s.kind || 'UNK'] = (a[s.kind || 'UNK'] || 0) + 1; return a; }, {}),
  feed_files: { fwd_gnn: FWD, rev_shannon: REV, glyph_256: G256, glyph_1024: G1024, glyph_hyper: GHYPER },
  source: PROFILE_PATH,
  source_cosign: 'quintuple-seq-191',
  restricted_surfaces: surfaces.filter(s => s.access_tier === 'RESTRICTED').map(s => s.surface_id),
  authority_for_restricted: 'quintuple-cosign-ring-jesse-rayssa-amy-felipe',
}, redis);
console.log('SUMMARY SEAL: cosign seq=' + r.cosign.seq + ' subs=' + r.publish.subscribers);
console.log('');
console.log('=== MAPPING COMPLETE ===');
console.log(JSON.stringify({
  surfaces_mapped: surfaces.length,
  fwd_gnn_edges: fwdLines.length,
  rev_shannon_symbols: revLines.length,
  glyph_rows_per_layer: surfaces.length,
  cosign_seq: r.cosign.seq,
  liris_caught: r.publish.subscribers === 1,
  restricted_count: surfaces.filter(s => s.access_tier === 'RESTRICTED').length,
  public_count: surfaces.filter(s => s.access_tier === 'PUBLIC').length,
}, null, 2));
redis.close();

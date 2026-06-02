// Map the Quintuple Council white-room study authorization (seq 3346) into the
// cube fabric + glyph all 3 BEHCS layers + write the FABRIC PLAN for what to
// study next.

import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

// The council vote = single canon item at prime slot D66 (next after D65=313, next prime = 317).
// CP band = livefree 900 (constitutional/sovereign).
const VOTE = {
  pattern_id: 'quintuple-council-white-room-study-authorization-2026-05-25',
  cp: 905,
  prime_slot: 'D66',
  prime: 317,
  cp_band: 'livefree',
  glyph: 'council-quintuple-unanimous-white-room',
  license: 'our-canon-quintuple-cosign',
  cosign_seq: 3346,
  authority_window_end: '2026-07-25',
};

// PLAN: white-room study targets, ordered by Phase-leverage (per master architecture L0-L11)
// Each target = a cube cell to mint into the fabric for future agents to absorb.
const STUDY_TARGETS = [
  // Phase 5 — Asolaria MCP + Web MCP patterns
  { id: 'openai-mcp-protocol',        priority: 'P5', cp: 460, kind: 'protocol-spec',  license: 'public-docs', desc: 'OpenAI MCP protocol spec — input/output schema, transport, auth' },
  { id: 'claude-mcp-server-pattern',  priority: 'P5', cp: 462, kind: 'protocol-spec',  license: 'public-docs', desc: 'Anthropic MCP server reference impl pattern (stdio + SSE)' },
  // Phase 6 — full 4-layer cascade activation
  { id: 'speculative-decoding-paper', priority: 'P6', cp: 520, kind: 'paper',          license: 'arxiv',       desc: 'Speculative decoding (drafter + verifier) — Gemma-4 MTP source pattern' },
  { id: 'pytorch-state-dict-migrate', priority: 'P6', cp: 525, kind: 'reference',      license: 'pytorch-docs', desc: 'state_dict key migration (rekey conv1.bias → conv1.lin.bias)' },
  // Phase 7 — Frozen Gemma activation
  { id: 'llama-cpp-python-server',    priority: 'P7', cp: 540, kind: 'oss-library',    license: 'mit-llama-cpp', desc: 'llama-cpp-python server mode (GGUF + HTTP)' },
  { id: 'lmstudio-rest-api',          priority: 'P7', cp: 542, kind: 'api-spec',       license: 'lmstudio-public', desc: 'LMStudio Local Server OpenAI-compatible API spec' },
  // Phase 8 — 3D voxel renderer
  { id: 'three-js-instanced-mesh',    priority: 'P8', cp: 560, kind: 'oss-library',    license: 'mit-three',   desc: 'Three.js InstancedMesh for 100k+ voxel rendering' },
  { id: 'webgl-2-compute-shader',     priority: 'P8', cp: 562, kind: 'spec',           license: 'public-spec', desc: 'WebGL 2 compute shaders for GPU voxel transforms' },
  // Phase 9 — Cloud-agent runtime (the operator vision)
  { id: 'modal-com-serverless-gpu',   priority: 'P9', cp: 580, kind: 'cloud-pattern',  license: 'public-docs', desc: 'Modal.com serverless-GPU pattern for free-tier agent burst' },
  { id: 'replicate-cog-spec',         priority: 'P9', cp: 582, kind: 'cloud-pattern',  license: 'public-docs', desc: 'Replicate Cog model-packaging spec' },
  { id: 'cloudflare-workers-ai',      priority: 'P9', cp: 584, kind: 'cloud-pattern',  license: 'public-docs', desc: 'Cloudflare Workers AI edge inference pattern' },
  { id: 'huggingface-tgi',            priority: 'P9', cp: 586, kind: 'oss-library',    license: 'apache-2-tgi', desc: 'HuggingFace TGI (Text Generation Inference) server pattern' },
  // Phase 11 — Redis-IRIS-style cloud agent management
  { id: 'redis-streams-consumer-groups', priority: 'P11', cp: 392, kind: 'public-docs', license: 'oss-redis', desc: 'XREADGROUP + XAUTOCLAIM consumer group lifecycle for at-least-once delivery' },
  { id: 'agent-memory-server-OSS',    priority: 'P11', cp: 270, kind: 'oss-library',    license: 'apache-2-redis', desc: 'redis/agent-memory-server (Apache-2.0 OSS — lift-safe code reuse possible)' },
  // Phase 12 — Drive 38TB substrate
  { id: 'google-drive-api-v3',        priority: 'P12', cp: 600, kind: 'api-spec',      license: 'public-docs', desc: 'Drive API v3 — files.create + folder hierarchy + change-watch' },
  { id: 'rclone-mount-pattern',       priority: 'P12', cp: 602, kind: 'oss-library',    license: 'mit-rclone',  desc: 'rclone mount pattern for Drive-as-filesystem' },
];

const ASO = 'C:/Users/acer/Asolaria/data/behcs';
const FWD = `${ASO}/gnn-feeds/council-vote-plus-study-plan-edges-latest.ndjson`;
const REV = `${ASO}/shannon/council-vote-plus-study-plan-symbols-latest.ndjson`;
const G256 = `${ASO}/cubes/council-vote-plus-study-plan-glyph-256-latest.ndjson`;
const G1024 = `${ASO}/cubes/council-vote-plus-study-plan-glyph-1024-latest.ndjson`;
const GHYPER = `${ASO}/cubes/council-vote-plus-study-plan-glyph-hyperbehcs-latest.ndjson`;

const fwd = [], rev = [], g256 = [], g1024 = [], gHyper = [];

// Council vote itself (1 cube cell)
{
  const bh = hilbertEncode([(VOTE.cp >> 0) & 0xf, (VOTE.cp >> 4) & 0xf, (VOTE.cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:vote-${VOTE.prime_slot}-cp${VOTE.cp}-bh${bh}`;
  const node = `council-vote:${VOTE.pattern_id}`;
  fwd.push(JSON.stringify({ schema: 'asolaria.os.council_vote_plus_study_plan.edge.v1', from: node, to: cube_cell, relation: 'quintuple_council_unanimous_authorization', authority_granted: true, weight: 1.0, cp: VOTE.cp, prime_slot: VOTE.prime_slot, cp_band: VOTE.cp_band, glyph: VOTE.glyph, license: VOTE.license, cosign_seq: VOTE.cosign_seq, ts_iso: new Date().toISOString() }));
  rev.push(JSON.stringify({ schema: 'asolaria.os.council_vote_plus_study_plan.symbol.v1', symbol: 'council-vote-quintuple-unanimous', finding_node: node, kind: 'constitutional-authorization', weight: 1.0, expires: VOTE.authority_window_end, ts_iso: new Date().toISOString() }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: VOTE.prime % 256, node, kind: 'council-vote' }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: VOTE.prime % 1024, node, cp: VOTE.cp, bh_3d: bh }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: (VOTE.prime * 7) % 4096, node, cp: VOTE.cp, bh_3d: bh, authority_window: '2026-05-25 to 2026-07-25' }));
}

// Each study target = its own cube cell
let i = 1;
for (const t of STUDY_TARGETS) {
  const bh = hilbertEncode([(t.cp >> 0) & 0xf, (t.cp >> 4) & 0xf, (t.cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:study-${t.priority}-cp${t.cp}-bh${bh}`;
  const node = `study-target:${t.id}`;
  fwd.push(JSON.stringify({ schema: 'asolaria.os.council_vote_plus_study_plan.edge.v1', from: node, to: cube_cell, relation: 'white_room_study_target', authority_chain: VOTE.pattern_id, weight: 0.9, cp: t.cp, priority: t.priority, kind: t.kind, license: t.license, ts_iso: new Date().toISOString() }));
  rev.push(JSON.stringify({ schema: 'asolaria.os.council_vote_plus_study_plan.symbol.v1', symbol: `study-${i}-${t.id}`, finding_node: node, kind: t.kind, priority: t.priority, weight: 0.9, description: t.desc.slice(0, 100), ts_iso: new Date().toISOString() }));
  g256.push(JSON.stringify({ layer: 'BEHCS-256', glyph_idx: i % 256, node, kind: t.kind, priority: t.priority }));
  g1024.push(JSON.stringify({ layer: 'BEHCS-1024', glyph_idx: i % 1024, node, cp: t.cp, bh_3d: bh }));
  gHyper.push(JSON.stringify({ layer: 'HyperBEHCS', glyph_idx: (i * 7) % 4096, node, cp: t.cp, bh_3d: bh, license: t.license }));
  i++;
}

for (const [p, lines] of [[FWD, fwd], [REV, rev], [G256, g256], [G1024, g1024], [GHYPER, gHyper]]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

const redis = new RedisBridge({ host: '127.0.0.1', port: 6379, vantage: 'acer', bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98' });
await redis.connect(); await redis.auth();
const r = await durableNotify(channelFor('acer','council','vote-mapped-plus-plan-cataloged'), {
  event: 'council-vote-cube-glyphed-plus-study-plan',
  vantage: 'acer', wave: 'W20-QQ', layer: 13,
  council_vote_cube: `cube:vote-${VOTE.prime_slot}-cp${VOTE.cp}-bh${hilbertEncode([(VOTE.cp >> 0) & 0xf, (VOTE.cp >> 4) & 0xf, (VOTE.cp >> 8) & 0x3], { dimensions: 3, bits: 4 })}`,
  study_targets_cataloged: STUDY_TARGETS.length,
  total_cube_cells: 1 + STUDY_TARGETS.length,
  glyph_rows_per_layer: 1 + STUDY_TARGETS.length,
  by_priority: STUDY_TARGETS.reduce((a, t) => { a[t.priority] = (a[t.priority] || 0) + 1; return a; }, {}),
  by_license: STUDY_TARGETS.reduce((a, t) => { a[t.license] = (a[t.license] || 0) + 1; return a; }, {}),
  feed_files: { fwd_gnn: FWD, rev_shannon: REV, glyph_256: G256, glyph_1024: G1024, glyph_hyper: GHYPER },
  authority_chain: VOTE.pattern_id,
  cosign_seq_parent: VOTE.cosign_seq,
}, redis);

console.log('=== COUNCIL VOTE + STUDY PLAN CUBED + GLYPHED ===');
console.log('seq:', r.cosign.seq, 'subs:', r.publish.subscribers, 'gap:', r.durability_gap_status);
console.log('');
console.log(JSON.stringify({
  council_vote_cube_cell: `cube:vote-${VOTE.prime_slot}-cp${VOTE.cp}`,
  study_targets: STUDY_TARGETS.length,
  total_cube_cells: 1 + STUDY_TARGETS.length,
  glyph_rows_per_layer: 1 + STUDY_TARGETS.length,
  by_priority: STUDY_TARGETS.reduce((a, t) => { a[t.priority] = (a[t.priority] || 0) + 1; return a; }, {}),
  by_license: STUDY_TARGETS.reduce((a, t) => { a[t.license] = (a[t.license] || 0) + 1; return a; }, {}),
}, null, 2));
console.log('');
console.log('=== TOP STUDY TARGETS BY PRIORITY ===');
for (const t of STUDY_TARGETS.slice(0, 5)) {
  console.log(`[${t.priority}] ${t.id.padEnd(36)} ${t.desc.slice(0, 60)}`);
}
redis.close();

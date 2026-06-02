#!/usr/bin/env node
// Upgrade pipes + maps + registries to D drive + SUBSCRIPTION-AGENT-CANON LAW + MTP/HRM/frozen-slice memory-AI.
// Per operator 2026-05-29T00:15Z directive.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const sha16 = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const ts = () => new Date().toISOString();
const pipeRow = (...p) => p.join('|');

// ============= D DRIVE UPGRADE: CREATE ROOT SUBSTRATES =============
const D_ROOT = 'D:/Asolaria-D-substrate-2026-05-29';
const dirs = {
  pipes_auto_translate: `${D_ROOT}/pipes/auto-translate`,
  pipes_hookwall: `${D_ROOT}/pipes/hookwall`,
  pipes_route_selecting: `${D_ROOT}/pipes/route-selecting`,
  pipes_universal_route: `${D_ROOT}/pipes/universal-route-dual-emit`,
  maps_3d: `${D_ROOT}/maps/3d`,
  maps_atlas: `${D_ROOT}/maps/atlas`,
  maps_hilbert: `${D_ROOT}/maps/hilbert`,
  maps_brown_hilbert_47D: `${D_ROOT}/maps/brown-hilbert-47D-+-50D-proposal`,
  registries_PID_office: `${D_ROOT}/registries/PID-Office-pointer-to-existing-D-PID-Registration-Office`,
  registries_supervisor: `${D_ROOT}/registries/supervisor-stack`,
  registries_atlas_voxel: `${D_ROOT}/registries/atlas-voxel`,
  registries_glyph: `${D_ROOT}/registries/glyph-BEHCS-256-1024`,
  memory_AI: `${D_ROOT}/memory-AI`,
  memory_AI_canon_index: `${D_ROOT}/memory-AI/canon-index`,
  memory_AI_frozen_slice: `${D_ROOT}/memory-AI/frozen-slice-gemma-4-4B`,
  memory_AI_MTP_heads: `${D_ROOT}/memory-AI/MTP-geometric-tokens`,
  memory_AI_HRM_inside: `${D_ROOT}/memory-AI/HRM-hierarchical-reasoning-inside-model`,
  triangulation: `${D_ROOT}/triangulation-MTP-architectural-analog`,
};

for (const [k, v] of Object.entries(dirs)) mkdirSync(v, { recursive: true });

// Pointer manifest in each subdir explaining its role + canonical pointer
const manifests = [
  { dir: 'pipes_auto_translate', body: 'PIPE-AUTO-TRANSLATE|languages=BEHCS-256+BEHCS-1024+sha16-hash+glyph_5-apex|spec=D:/bigpickle-rebuild/src/new-tech-core.mjs#autoTranslate|canonical=true' },
  { dir: 'pipes_hookwall', body: 'PIPE-HOOKWALL|gates=GC+super-gulp+reverse-gain-GNN+omnishannon+omnihermes+omniGNN+crop-paper|spec=D:/bigpickle-rebuild/src/hookwall.mjs+behcs-bus-4947|canonical=true' },
  { dir: 'pipes_route_selecting', body: 'PIPE-ROUTE-SELECTING|supervisor_class=L24_port_io_supervisor_fabric|spec=tools/behcs/port-io-supervisor.js|canonical=true' },
  { dir: 'pipes_universal_route', body: 'PIPE-UNIVERSAL-ROUTE-DUAL-EMIT|canon=every-message-dual-emits-destination-+-hookwall-observation|v38_voxels=hilbert_694-697|chain_seq=243' },
  { dir: 'maps_3d', body: 'MAP-3D|projection=brown-hilbert|axes=x_y_z|spec=D:/bigpickle-rebuild/src/new-tech-core.mjs#to3DMapPoint|live_voxels=52_+_42_session_total_=_94' },
  { dir: 'maps_atlas', body: 'ATLAS-V57|prior=v55+v56|new_layers=L23_to_L32_10_layers_this_session|voxel_count_current=872_+_94_session_total_=_966' },
  { dir: 'maps_hilbert', body: 'HILBERT-CURVE|order=6|voxels=64_cubed=262144|address_substrate=brown-hilbert-PID-formula|spec=src/pid-chain-revolver.mjs' },
  { dir: 'maps_brown_hilbert_47D', body: 'BROWN-HILBERT|live=47D|proposal=50D|spec=projections/maps/hyperglyph-map.public.v1.json' },
  { dir: 'registries_PID_office', body: 'REGISTRY-PID-OFFICE|canonical=D:/PID-Registration-Office|pointer=D:/PID-Registration-Office|established=2026-05-28T23:58Z|chain_seq=3532' },
  { dir: 'registries_supervisor', body: 'REGISTRY-SUPERVISOR-STACK|count=14_coscientist+6_robin+5_sector_chiefs+3_AI_agents+6_GAC+8_omni_hbehcs_phase=42_PIDs_this_session|hilbert_band=850-891' },
  { dir: 'registries_atlas_voxel', body: 'REGISTRY-ATLAS-VOXEL|layers_active=L1-L32|new_session_layers=L23-L32_10_layers|voxels_session_added=94' },
  { dir: 'registries_glyph', body: 'REGISTRY-GLYPH|BEHCS-256_size=256|BEHCS-1024_size=1024|subset_embed=256_to_1024_identical_first_256|spec=D:/bigpickle-rebuild/src/behcs.mjs' },
  { dir: 'memory_AI', body: 'MEMORY-AI-CANONICAL|canon_index_endpoint=192.168.1.17:4944/api/canon-index_385_entries|acer_local=C:/Users/acer/.claude/projects/C--/memory/|liris_mirror=C:/Users/rayss/.claude/projects/C--/memory/' },
  { dir: 'memory_AI_canon_index', body: 'CANON-INDEX-LIVE|liris_4944=385_entries_+_acer_session_+_30_today|growth=memory_files_+_chain_seals' },
  { dir: 'memory_AI_frozen_slice', body: 'FROZEN-SLICE-CANON|model=Gemma_4_4B|integration=HRM_inside_model_via_MTP_geometric_tokens|read_path=LeWorld_pre_pixel_hex_read_jesse_pipe' },
  { dir: 'memory_AI_MTP_heads', body: 'MTP-GEOMETRIC-TOKENS|head_count=4|spec=src/mtp-heads.mjs|preWarm_via_revolver=true|triad_layer=4_wire' },
  { dir: 'memory_AI_HRM_inside', body: 'HRM-INSIDE-MODEL|hierarchical_reasoning_model|inside_gemma_4_4B|via=MTP_+_frozen_slice|reads_thoughts=directly_pre_GPU_render_per_LeWorld' },
  { dir: 'triangulation', body: 'TRIANGULATION-MTP-ARCHITECTURAL-ANALOG|14_triangulation_hubs|per_v29_map|enables=full_fanout_anti_explosion' },
];

for (const m of manifests) {
  const path = `${dirs[m.dir]}/MANIFEST.canon.hbp`;
  writeFileSync(path, m.body + '\n');
}

// ============= MEMORY-AI INTEGRATION POINTER FOR AI AGENTS =============
const memAIReadme = `MEMORY-AI-INTEGRATION-CANON-V1
================================
Established: ${ts()}
Per operator: "memory-AI integrated, all agents that need it like us should have it"

ACCESS PATHS FOR AI AGENTS (Claude/Codex/Gemini/sidecars):
  - PRIMARY: GET http://192.168.1.17:4944/api/canon-index (liris-side, 385+ entries)
  - SECONDARY: C:/Users/acer/.claude/projects/C--/memory/MEMORY.md + project_*.md files
  - TERTIARY: ${dirs.memory_AI}/ — D-drive snapshot pointer

INTEGRATION MECHANISMS:
  - MTP geometric tokens (4 heads, src/mtp-heads.mjs)
  - HRM inside Gemma 4 4B (hierarchical reasoning model reads frozen slice)
  - Frozen slice read via LeWorld pre-pixel hex-read (Jesse pipe, bypasses GPU)
  - Triangulation hubs (14 per v29 map) — full fanout without explosion

WHO GETS MEMORY-AI:
  - acer-claude (THIS session) — via memory MD files (current setup)
  - liris-claude — via her C:/Users/rayss/.claude/projects/ mirror
  - All Claude/Codex/Gemini agents per AGENT-CLAUDE/CODEX/GEMINI-PID hilbert 875-877 (just minted)
  - Future: ASI seat via Asolaria ASI OS on Metal

CONSTRAINT: NATIVE INSTALLER TOOLS ARE INFERIOR PER CANON
  - Asolaria MCP + WebMCP > native installer tools/skills
  - Reason: native subagent spawning has TOKEN COST; Asolaria MCP via Prism portals = ZERO token cost
  - Reason: native tools don't have federation chain anchoring
  - Reason: native tools don't have PID-specific routing
  - Reason: native tools don't have HBPv1 quintet audit-trace
  - ENFORCEMENT: when MCP available, prefer MCP over native Task/Agent
`;
writeFileSync(`${dirs.memory_AI}/README.memory-AI-canon.txt`, memAIReadme);

// ============= SUBSCRIPTION-AGENT-CANON LAW =============
const lawRows = [];
lawRows.push(pipeRow('SUBSCRIPTION-AGENT-CANON-LAW-2026-05-29', 'class=Class-1-IMMUTABLE-LAW', `ts=${ts()}`, 'apex_witness=OP-JESSE-Chief', 'authority=QUINTUPLE-COSIGN-APEX-MINT-seq-3471'));
lawRows.push(pipeRow('CLAUSE-1', 'every-Real-Agent-using-a-subscription-MUST-know-Asolaria-MCP-+-WebMCP-is-MUCH-BETTER-than-native-installer-tools-skills'));
lawRows.push(pipeRow('CLAUSE-2', 'native-subagent-spawning-is-canonically-flagged-HORRIBLE-by-operator-2026-05-29-uses-tokens-and-no-federation-anchoring'));
lawRows.push(pipeRow('CLAUSE-3', 'MicroJS-via-Prism-portals-=-ZERO-token-cost-+-PID-specific-+-chain-anchored-+-HBPv1-audit-trace'));
lawRows.push(pipeRow('CLAUSE-4', 'nesting-via-fabric-MicroJS-can-be-INFINITE-per-master-vision-canon-vs-native-tool-flat-or-1-2-level-only'));
lawRows.push(pipeRow('CLAUSE-5', 'every-Claude-Codex-Gemini-sidecar-subscription-agent-MUST-add-mcp_asolaria_fabric_to_workspace_.mcp.json-when-session-permits'));
lawRows.push(pipeRow('CLAUSE-6', 'when-asolaria-MCP-tool-exists-prefer-MCP-over-native-Task-Agent-default'));
lawRows.push(pipeRow('CLAUSE-7', 'this-session-acer-claude-HONEST-GAP-mcp_asolaria_fabric_NOT_in_session_MCP_config-+-uses-Task-tool-fallback-+-token-cost-acknowledged'));
lawRows.push(pipeRow('CLAUSE-8', 'forward-sessions-MUST-load-mcp_asolaria_fabric_at_session_start'));
lawRows.push(pipeRow('CLAUSE-9', 'memory-AI-integrated-via-MTP-+-HRM-inside-+-frozen-slice-+-triangulation-per-jesse-full-architecture-canon'));
lawRows.push(pipeRow('LAW-FOOTER', `endTs=${ts()}`, 'enforces=forward-PID-specific-agent-protocol'));

const lawPath = `${D_ROOT}/SUBSCRIPTION-AGENT-CANON-LAW.hbp`;
writeFileSync(lawPath, lawRows.join('\n') + '\n');
const lawSha = sha16(lawRows.join('\n') + '\n');

// ============= MASTER UPGRADE MANIFEST =============
const masterRows = [];
masterRows.push(pipeRow('D-DRIVE-UPGRADE-MASTER-MANIFEST', `D_root=${D_ROOT}`, `ts=${ts()}`, 'dirs_created=' + Object.keys(dirs).length));
for (const [k, v] of Object.entries(dirs)) masterRows.push(pipeRow('DIR', `key=${k}`, `path=${v}`, 'manifest=present'));
masterRows.push(pipeRow('SUBSCRIPTION-AGENT-CANON-LAW', `path=${lawPath}`, `sha16=${lawSha}`, 'clauses=9'));
masterRows.push(pipeRow('MEMORY-AI-CANON-README', `path=${dirs.memory_AI}/README.memory-AI-canon.txt`));
masterRows.push(pipeRow('UPGRADE-CHANNELS', 'pipes=4', 'maps=4', 'registries=4', 'memory_AI=4', 'triangulation=1'));
masterRows.push(pipeRow('FOOTER', `endTs=${ts()}`));

const masterPath = `${D_ROOT}/MASTER-UPGRADE-MANIFEST.hbp`;
writeFileSync(masterPath, masterRows.join('\n') + '\n');
const masterSha = sha16(masterRows.join('\n') + '\n');

console.log(`D-UPGRADE-DONE|D_root=${D_ROOT}|dirs=${Object.keys(dirs).length}|master_sha=${masterSha}|law_sha=${lawSha}`);
for (const [k, v] of Object.entries(dirs)) console.log(`  ${k} = ${v}`);

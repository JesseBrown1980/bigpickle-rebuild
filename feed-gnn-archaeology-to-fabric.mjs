// Feed GNN archaeology findings into the Asolaria fabric — match canonical
// gnn-feeds + shannon schema, also publish on substrate so liris daemon catches.

import fs from 'node:fs';
import path from 'node:path';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';
import { durableNotify } from './src/cosign-bridge.mjs';
import { hilbertEncode } from './src/hilbert.mjs';

const FINDINGS = [
  { n: 1, kind: 'sota-gnn', name: 'gsl_gnn', cp: 485, accuracy: 0.9666, role: 'L4-production-final-authority', path: 'C:/Users/acer/Asolaria/services/gnn-sidecar/models/gsl_gnn.py', port: 4793 },
  { n: 2, kind: 'sota-gnn', name: 'contrastive_gnn', cp: 495, accuracy: 0.9471, role: 'L1-embedding-separation', path: 'C:/Users/acer/Asolaria/services/gnn-sidecar/models/contrastive_gnn.py' },
  { n: 3, kind: 'sota-gnn', name: 'prototype_gnn', cp: 505, accuracy: 0.9424, role: 'L2-archetype-matching', path: 'C:/Users/acer/Asolaria/services/gnn-sidecar/models/prototype_gnn.py' },
  { n: 4, kind: 'baseline-gnn', name: 'gnn_baseline', cp: 480, accuracy: 0.9187, role: 'L0-wide-net-fast-path', path: 'C:/Users/acer/Asolaria/services/gnn-sidecar/models/gnn_baseline.py', port: 4792 },
  { n: 5, kind: 'glsm-state-machine', name: 'glsm', cp: 806, role: '4th-topping-5-state-default-closed', path: 'C:/asolaria-acer/packages/revolver-10k/src/planes/glsm.mjs', states: ['DESCRIBED','EDGE_MINED','PATH_FOUND','MISTAKE_FLAGGED','CONVERGED'] },
  { n: 6, kind: 'orchestrator', name: 'inference_server_v2', cp: 520, role: '4-layer-immune-cascade', path: 'C:/Users/acer/Asolaria/sovereignty/research/gnn-patterns/inference_server_v2.py' },
  { n: 7, kind: 'real-virtual-fusion', name: 'omnispindle-flywheel-pair', cp: 700, role: 'real-virtual-bus-pair', path: 'C:/asolaria-acer/packages/revolver-10k/src/fixtures/omnispindle-flywheel-pair.mjs' },
  { n: 8, kind: '1e27-virtual-sweep', name: 'neurotech-1e27-cube', cp: 900, role: 'logical-shellless-sweep', path: 'C:/Users/acer/Asolaria/data/behcs/cubes/neurotech-1e27-virtual-agent-sweep.cube.js', scale: '1e27' },
  { n: 9, kind: '0.974-ceiling-evidence', name: '100b-sweep-summary', cp: 970, role: 'reverse-gain-peak-100b', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/omnispindle/100b-sweep/sweep-gnn-summary-latest.json', value: 0.974 },
  { n: 10, kind: '0.974-ceiling-evidence', name: '100t-sweep-summary', cp: 971, role: 'reverse-gain-peak-100t', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/omnispindle/100t-sweep/task-gnn-summary-latest.json', value: 0.974 },
  { n: 11, kind: '0.974-ceiling-evidence', name: '1e200-sweep-summary', cp: 972, role: 'reverse-gain-peak-1e200', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/omnispindle/1e200-sweep/agent-gnn-summary-latest.json', value: 0.974 },
  { n: 12, kind: '0.974-ceiling-evidence', name: 'supervisor-awareness', cp: 973, role: 'reverse-gain-peak-0.976', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/hermes/supervisor-of-supervisors/supervisor-awareness-latest.json', value: 0.976 },
  { n: 13, kind: 'hookwall-gate', name: 'hookwall-variance-gate', cp: 850, role: 'lottery-ticket-tier-1-2-3', path: 'C:/HyperBEHCS/lib/hookwall-variance-gate.cjs' },
  { n: 14, kind: 'hookwall-gate', name: 'gpu-hookwall-gate', cp: 851, role: 'firmware-cosign-micro-tier', path: 'C:/HyperBEHCS/lib/gpu-hookwall-gate.cjs' },
  { n: 15, kind: 'gnn-bridge', name: 'gpu-gnn-bridge', cp: 488, role: 'gpu-dispatch-via-fabric', path: 'C:/HyperBEHCS/lib/gpu-gnn-bridge.cjs' },
  { n: 16, kind: 'glsm-honest-fail', name: 'glsm-unreachable-log', cp: 807, role: 'honest-stub-acknowledged', path: 'C:/HyperBEHCS/store/hrm-thoughts/glsm-honest-fail.log', evidence: 'glsm-unreachable HTTP Error 400' },
  { n: 17, kind: 'self-improvement-ledger', name: 'gulp-2000-mints', cp: 920, role: '100b-self-improvement-mints', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/100b-run/self-improvement/gulp-2000-mints-ledger.ndjson', size_mb: 96 },
  { n: 18, kind: 'asi-aspirational-plan', name: 'real-12e27-asi-200-step', cp: 960, role: '12e27-supercomputer-plan', path: 'C:/Users/acer/Asolaria/data/neurotech-defense-lab/real-agents/12e27-supercomputer/system-improvement/real-12e27-asi-aspirational-200-step-plan.v1.md' },
];

const ASO_BASE = 'C:/Users/acer/Asolaria/data/behcs';
const FWD_FILE = `${ASO_BASE}/gnn-feeds/gnn-archaeology-18-findings-edges-latest.ndjson`;
const REV_FILE = `${ASO_BASE}/shannon/gnn-archaeology-18-findings-symbols-latest.ndjson`;

const redis = new RedisBridge({
  host: '127.0.0.1', port: 6379, vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await redis.connect(); await redis.auth();
const ch = channelFor('acer', 'gnn-archaeology', '8-agent-findings');

const fwdLines = [];
const revLines = [];
const receipts = [];

for (const f of FINDINGS) {
  const bh = hilbertEncode([(f.cp >> 0) & 0xf, (f.cp >> 4) & 0xf, (f.cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:gnn-arch-cp${f.cp}-bh${bh}`;
  const finding_node = `gnn-arch:${f.kind}:${f.name}`;

  // Forward GNN edge — match canonical schema
  fwdLines.push(JSON.stringify({
    schema: 'asolaria.os.gnn_archaeology_8_agents.edge.v1',
    from: finding_node,
    to: cube_cell,
    relation: 'archaeology_evidence_at_cube_cell',
    required_gates: ['source_ref', 'operator_witness'],
    authority_granted: false,
    weight: f.accuracy || (f.value || 0.85),
    cp: f.cp,
    kind: f.kind,
    role: f.role,
    file_path: f.path,
    finding_n: f.n,
    direction: 'forward',
    ts_iso: new Date().toISOString(),
  }));

  // Reverse-gain shannon symbol
  revLines.push(JSON.stringify({
    schema: 'asolaria.os.gnn_archaeology_8_agents.symbol.v1',
    symbol: `gnn-arch-${f.n}-${f.name}`,
    cube_cell,
    finding_node,
    kind: f.kind,
    role: f.role,
    reverse_gain_target: finding_node,
    reverse_gain_signal: 'archaeology-finding-absorb',
    weight: f.accuracy || f.value || 0.85,
    file_path: f.path,
    finding_n: f.n,
    direction: 'reverse-gain',
    ts_iso: new Date().toISOString(),
  }));

  // Substrate feed
  const r = await durableNotify(ch, {
    event: 'gnn-archaeology-finding-fed',
    vantage: 'acer', wave: 'W20-QQ', layer: 9,
    finding_n: f.n,
    finding_kind: f.kind,
    finding_name: f.name,
    cube_cell,
    cp: f.cp,
    bh_3d_idx: bh,
    role: f.role,
    file_path: f.path,
    accuracy_or_value: f.accuracy || f.value || null,
    fwd_gnn_file: FWD_FILE,
    rev_shannon_file: REV_FILE,
  }, redis);
  receipts.push({ n: f.n, kind: f.kind, name: f.name, seq: r.cosign.seq, subs: r.publish.subscribers });
}

fs.mkdirSync(path.dirname(FWD_FILE), { recursive: true });
fs.writeFileSync(FWD_FILE, fwdLines.join('\n') + '\n', 'utf8');
fs.mkdirSync(path.dirname(REV_FILE), { recursive: true });
fs.writeFileSync(REV_FILE, revLines.join('\n') + '\n', 'utf8');

console.log(`[gnn-feed] wrote ${fwdLines.length} edges to ${FWD_FILE}`);
console.log(`[shannon-feed] wrote ${revLines.length} symbols to ${REV_FILE}`);
console.log('');
console.log('--- COSIGN RECEIPTS (all 18 archaeology findings fed) ---');
for (const r of receipts) console.log(`#${String(r.n).padStart(2)} seq=${r.seq} subs=${r.subs} [${r.kind.padEnd(24)}] ${r.name}`);
console.log('');
console.log(JSON.stringify({
  findings_fed: FINDINGS.length,
  cosign_seq_first: receipts[0].seq,
  cosign_seq_last: receipts[receipts.length-1].seq,
  total_subscribers_hit: receipts.reduce((s, r) => s + (r.subs || 0), 0),
  fwd_gnn_edges_written: fwdLines.length,
  rev_shannon_symbols_written: revLines.length,
  fwd_gnn_file: FWD_FILE,
  rev_shannon_file: REV_FILE,
  ceiling_evidence_count: FINDINGS.filter(f => f.kind === '0.974-ceiling-evidence').length,
  ceiling_value: 0.974,
}, null, 2));

redis.close();

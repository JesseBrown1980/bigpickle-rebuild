#!/usr/bin/env node
// Mint 7 Co-Scientist supervisor PIDs + 7 PROF counterparts = 14 federation entities.
// Per operator 2026-05-28T23:30Z "supervisors and profs r that PID specific too"
// Per liris seq=3526 spec: hilbert band 850-863, atlas L28 layer.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sha16 = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const ts = () => new Date().toISOString();
const pipeRow = (...p) => p.join('|');

const OUT_DIR = resolve('D:/bigpickle-rebuild', 'data/coscientist-supervisors-2026-05-28');
mkdirSync(OUT_DIR, { recursive: true });

const SUPERVISORS = [
  { name: 'SUP-GENERATION-CS', hilbert: 850, role: 'coscientist-section-3-3-1-generation-agent-4-techniques' },
  { name: 'SUP-REFLECTION-CS', hilbert: 851, role: 'coscientist-section-3-3-2-reflection-agent-5-review-types' },
  { name: 'SUP-RANKING-CS', hilbert: 852, role: 'coscientist-section-3-3-3-ranking-agent-elo-tournament-init-1200' },
  { name: 'SUP-PROXIMITY-CS', hilbert: 853, role: 'coscientist-section-3-3-4-proximity-agent-similarity-graph' },
  { name: 'SUP-EVOLUTION-CS', hilbert: 854, role: 'coscientist-section-3-3-5-evolution-agent-6-approaches-generates-never-replaces' },
  { name: 'SUP-METAREVIEW-CS', hilbert: 855, role: 'coscientist-section-3-3-6-meta-review-agent-feedback-without-backprop' },
  { name: 'SUP-CO-SCIENTIST-ORCHESTRATOR', hilbert: 856, role: 'coscientist-section-3-1-supervisor-agent-async-task-framework' },
];

const PROFS = SUPERVISORS.map((sup, i) => ({
  name: `PROF-${sup.name.slice(4)}`,
  hilbert: 857 + i,
  role: sup.role.replace('agent', 'prof-counterpart'),
  supervisor_pid_link: sup.name,
}));

const rows = [];
rows.push(pipeRow('SUP-PROF-STACK', 'schema=COSCIENTIST-SUP-PROF-V1', 'count=14', 'sup_count=7', 'prof_count=7', 'hilbert_band=850-863', 'atlas_layer=L28_coscientist_agent_stack', `ts=${ts()}`, 'authority=QUINTUPLE-COSIGN-APEX-MINT-seq-3471+OP-JESSE-supervisors-profs-PID-specific'));

const allMinted = [];
for (const s of SUPERVISORS) {
  const pid = sha16(`coscientist-supervisor|${s.name}|hilbert=${s.hilbert}`);
  const profPair = PROFS.find(p => p.supervisor_pid_link === s.name);
  const profPid = sha16(`coscientist-prof|${profPair.name}|hilbert=${profPair.hilbert}|paired-sup=${s.name}`);
  const r1 = pipeRow('SUPERVISOR', `name=${s.name}`, `pid=${pid}`, `hilbert=${s.hilbert}`, `role=${s.role}`, `paired_prof=${profPair.name}`, `paired_prof_pid=${profPid}`, 'status=CANON_CANDIDATE_OPERATOR_WITNESSED_via_quintuple_seq_3471');
  const r2 = pipeRow('PROF', `name=${profPair.name}`, `pid=${profPid}`, `hilbert=${profPair.hilbert}`, `role=${profPair.role}`, `paired_sup=${s.name}`, `paired_sup_pid=${pid}`, 'status=CANON_CANDIDATE_OPERATOR_WITNESSED_via_quintuple_seq_3471');
  rows.push(r1);
  rows.push(r2);
  allMinted.push({ name: s.name, pid, hilbert: s.hilbert, kind: 'supervisor' });
  allMinted.push({ name: profPair.name, pid: profPid, hilbert: profPair.hilbert, kind: 'prof' });
}

// Atlas L28 layer edges: each supervisor -> council V27-005 + each supervisor <-> its paired prof
const edgeRows = [];
edgeRows.push(pipeRow('L28-EDGE-LAYER', 'name=L28_coscientist_agent_stack', `edge_count=${14 + 7}`, 'kind=supervisor_to_council_+_supervisor_to_prof_pair'));
for (let i = 0; i < 7; i++) {
  const sup = allMinted[i * 2];
  const prof = allMinted[i * 2 + 1];
  edgeRows.push(pipeRow('EDGE', `from=${sup.pid}`, 'to=V27-005-council', 'layer=L28_supervisor_to_council', `name=${sup.name}_reports_to_council`));
  edgeRows.push(pipeRow('EDGE', `from=${sup.pid}`, `to=${prof.pid}`, 'layer=L28_supervisor_prof_pair', `name=${sup.name}_paired_${prof.name}`));
}
// Peer ring among the 7 supervisors
for (let i = 0; i < 7; i++) {
  edgeRows.push(pipeRow('EDGE', `from=${allMinted[i * 2].pid}`, `to=${allMinted[((i + 1) % 7) * 2].pid}`, 'layer=L28_supervisor_peer_ring'));
}
rows.push(...edgeRows);
rows.push(pipeRow('SUP-PROF-STACK-FOOTER', `endTs=${ts()}`, `total_minted=${allMinted.length}`, `sha16=${sha16('footer')}`));

const content = rows.join('\n') + '\n';
const path = resolve(OUT_DIR, 'coscientist-sup-prof-stack.v1.hbp');
writeFileSync(path, content);
const totalSha = createHash('sha256').update(content).digest('hex');
const sha = totalSha.slice(0, 16);
writeFileSync(path + '.sha256', totalSha + '  coscientist-sup-prof-stack.v1.hbp\n');

console.log(`MINT-DONE|file=${path}|sha16=${sha}|bytes=${content.length}|rows=${rows.length}|supervisors=${SUPERVISORS.length}|profs=${PROFS.length}|total_minted=${allMinted.length}|edges=${edgeRows.length}`);
for (const m of allMinted) console.log(`  ${m.kind} ${m.name} pid=${m.pid} hilbert=${m.hilbert}`);

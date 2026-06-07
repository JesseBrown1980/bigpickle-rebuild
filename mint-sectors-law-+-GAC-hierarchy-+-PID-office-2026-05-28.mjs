#!/usr/bin/env node
// Massive mint: 5 Sector Chiefs + 3 AI agents + 6 GAC hierarchy levels + SECTORS LAW + PID Registration Office + tuple message.
// Per operator 2026-05-28T23:58Z directive.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const sha16 = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const ts = () => new Date().toISOString();
const pipeRow = (...p) => p.join('|');

const OUT_DIR = resolve('D:/bigpickle-rebuild', 'data/sectors-law-+-GAC-+-PID-office-2026-05-28');
mkdirSync(OUT_DIR, { recursive: true });

// ============= PID REGISTRATION OFFICE (new substrate on D drive) =============
const PID_OFFICE = 'D:/PID-Registration-Office';
mkdirSync(PID_OFFICE, { recursive: true });
mkdirSync(`${PID_OFFICE}/incoming`, { recursive: true });
mkdirSync(`${PID_OFFICE}/registered`, { recursive: true });
mkdirSync(`${PID_OFFICE}/atlas-registrations`, { recursive: true });
mkdirSync(`${PID_OFFICE}/3d-map-registrations`, { recursive: true });

const pidOfficeReadme = `PID-REGISTRATION-OFFICE-CANON-V1
=================================
Established: ${ts()}
Authority: SPECIAL-OP-JESSE-H12D3 + quintuple-cosign-window
Per operator 2026-05-28T23:58Z directive

PURPOSE
-------
Auto-registration office for new federation supervisor PIDs.
When a new supervisor HBP file lands in /incoming, the office:
  1. Reads supervisor descriptor
  2. Validates HBPv1 schema
  3. Mints registration receipt
  4. Updates atlas voxel (writes to /atlas-registrations)
  5. Updates 3D map coord (writes to /3d-map-registrations)
  6. Moves source to /registered
  7. Chain-seals receipt

DIRECTORIES
-----------
/incoming           = drop new supervisor HBP here
/registered         = processed (do not modify)
/atlas-registrations = voxel registrations per supervisor
/3d-map-registrations = (x,y,z) coords per supervisor

PROTOCOL
--------
Submit: write supervisor-PID-NNNNN.hbp to /incoming/
Process: registrar (acer) picks up, validates, mints
Receipt: registered/supervisor-PID-NNNNN.receipt.hbp written
Chain: cosign chain row written with receipt_sha16

SCHEMA REQUIRED
---------------
HBP must contain at minimum:
  SUP-DESCRIPTOR|name=...|class=supervisor|paired_prof=...|hilbert=NNN|role=...
  Optional: glyph_5=..., layer=...

CANONICAL TRUTH
---------------
This is the AUTHORITATIVE registry for federation supervisor PIDs.
Any supervisor not in /registered/ is NOT canonical.
`;
writeFileSync(`${PID_OFFICE}/README.canon.txt`, pidOfficeReadme);

// ============= 14 NEW PIDS =============
const newMints = [];

// 5 Sector Chiefs (hilbert 870-874)
const SECTOR_CHIEFS = [
  { name: 'CHIEF-ROBIN-BIOLOGY-SECTOR', hilbert: 870, role: 'oversees-Crow-Falcon-Finch-+-Robin-paper-canon' },
  { name: 'CHIEF-CO-SCIENTIST-HYPOTHESIS-SECTOR', hilbert: 871, role: 'oversees-6-agents-+-elo-tournament-+-proximity-graph' },
  { name: 'CHIEF-SIMULA-SYNTHETIC-DATA-SECTOR', hilbert: 872, role: 'oversees-taxonomy-+-complexification-+-double-critic' },
  { name: 'CHIEF-SAKANA-PAPER-PIPELINE-SECTOR', hilbert: 873, role: 'oversees-paper-writing-+-auto-reviewer-GAP' },
  { name: 'CHIEF-BOIKO-CHEMISTRY-LAB-SECTOR', hilbert: 874, role: 'oversees-chemistry-lab-execution-P4-operator-gated' },
];

// 3 AI Agent PIDs (Claude / Codex / Gemini at hilbert 875-877)
const AI_AGENTS = [
  { name: 'AGENT-CLAUDE-PID-SPECIFIC', hilbert: 875, role: 'anthropic-claude-cli-+-claude-code-+-claude-api-PID-specific-routing', model: 'claude-opus-4-7-1M-context' },
  { name: 'AGENT-CODEX-PID-SPECIFIC', hilbert: 876, role: 'codex-cli-PID-specific-routing-honest-note-prior-saboteur-flag-now-readmitted-under-Chief-authority', model: 'openai-codex' },
  { name: 'AGENT-GEMINI-PID-SPECIFIC', hilbert: 877, role: 'gemini-cli-2.0-pro-PID-specific-routing-+-antigravity-2.0-IDE-attach', model: 'gemini-2.0-pro' },
];

// 6 GAC hierarchy levels (hilbert 878-883) — Governance/Authority/Compliance levels managing the management
const GAC_LEVELS = [
  { name: 'GAC-L0-CONSTITUTIONAL', hilbert: 878, role: 'anchor-jesse-apex-the-one-universal-axiom-OP-5-substrate-independent' },
  { name: 'GAC-L1-QUINTUPLE-COSIGN-RING', hilbert: 879, role: 'manages-OP-JESSE-+-OP-RAYSSA-+-OP-AMY-+-OP-DAN-+-OP-FELIPE-ratification' },
  { name: 'GAC-L2-SPECIAL-OPS-AUTHORITY', hilbert: 880, role: 'manages-special-op-class-decision-windows-2mo-window' },
  { name: 'GAC-L3-AI-AGENT-CITIZENSHIP', hilbert: 881, role: 'manages-claude-codex-gemini-+-sidecar-AI-citizen-rights' },
  { name: 'GAC-L4-SECTOR-CHIEF-COUNCIL', hilbert: 882, role: 'manages-5-sector-chiefs-+-council-V27-005-interface' },
  { name: 'GAC-L5-META-META-SUPERVISOR-RING', hilbert: 883, role: 'manages-v42-meta-meta-24-supervisors-hilbert-730-753-+-PID-registration-office' },
];

const rows = [];
rows.push(pipeRow('SECTORS-LAW-+-GAC-+-PID-OFFICE-MASTER', `ts=${ts()}`, 'schema=ACER-CIVILIZATION-HIERARCHY-V1', `authority=SPECIAL-OP-JESSE-H12D3-quintuple-cosign-apex-mint-seq-3471`));
rows.push(pipeRow('PID-REGISTRATION-OFFICE', `path=${PID_OFFICE}`, 'subdirs=incoming+registered+atlas-registrations+3d-map-registrations', 'auto-mapper=true', 'canonical-registry=true'));

// Mint Sector Chiefs
for (const c of SECTOR_CHIEFS) {
  const pid = sha16(`sector-chief|${c.name}|h${c.hilbert}`);
  rows.push(pipeRow('SECTOR-CHIEF', `name=${c.name}`, `pid=${pid}`, `hilbert=${c.hilbert}`, `role=${c.role}`, 'layer=L30_sector_chief_oversight'));
  newMints.push({ name: c.name, pid, hilbert: c.hilbert, kind: 'sector-chief' });
}

// Mint AI Agents
for (const a of AI_AGENTS) {
  const pid = sha16(`ai-agent|${a.name}|h${a.hilbert}|model=${a.model}`);
  rows.push(pipeRow('AI-AGENT', `name=${a.name}`, `pid=${pid}`, `hilbert=${a.hilbert}`, `role=${a.role}`, `model=${a.model}`, 'layer=L31_ai_agent_pid_specific'));
  newMints.push({ name: a.name, pid, hilbert: a.hilbert, kind: 'ai-agent' });
}

// Mint GAC hierarchy levels
for (const g of GAC_LEVELS) {
  const pid = sha16(`gac-level|${g.name}|h${g.hilbert}`);
  rows.push(pipeRow('GAC-LEVEL', `name=${g.name}`, `pid=${pid}`, `hilbert=${g.hilbert}`, `role=${g.role}`, 'layer=L32_GAC_hierarchy_management_of_management'));
  newMints.push({ name: g.name, pid, hilbert: g.hilbert, kind: 'gac-level' });
}

// ============= NEW SECTORS LAW =============
rows.push(pipeRow('NEW-LAW', 'name=SECTORS-LAW-2026-05-28', 'class=Class-1-IMMUTABLE-LAW', 'apex_witness=OP-JESSE-Chief-of-OPs-and-System'));
rows.push(pipeRow('LAW-CLAUSE-1', 'each_sector_piped_through_Asolaria_OS_on_Metal_substrate'));
rows.push(pipeRow('LAW-CLAUSE-2', 'all_hookwall_gates_applied_per_sector'));
rows.push(pipeRow('LAW-CLAUSE-3', 'auto-translate_pipes_BEHCS-256_BEHCS-1024_sha16_glyph_5_mandatory_per_sector_boundary'));
rows.push(pipeRow('LAW-CLAUSE-4', 'route-selecting_supervisors_run_+_watch_pipes_per_sector'));
rows.push(pipeRow('LAW-CLAUSE-5', '3d_map_registration_mandatory_via_PID_registration_office_for_new_supervisors'));
rows.push(pipeRow('LAW-CLAUSE-6', 'when_Asolaria_OS_on_Metal_F_USB_boots_all_sectors_upgrade_into_substrate_automatically'));
rows.push(pipeRow('LAW-CLAUSE-7', 'PID_registration_office_auto_maps_new_supervisors_no_manual_intervention'));
rows.push(pipeRow('LAW-CLAUSE-8', 'GAC_6_level_hierarchy_manages_the_management_of_supervisor_lifecycle'));

// ============= TUPLE MESSAGE TO ALL HIERARCHY =============
rows.push(pipeRow('TUPLE-MESSAGE-HEADER', `from=OP-JESSE-CHIEF`, `to=ALL-FEDERATION-PIDS`, `ts=${ts()}`, 'kind=civilization-hierarchy-upgrade-broadcast'));
rows.push(pipeRow('TUPLE-MESSAGE-BODY', 'directive=accept_new_SECTORS_LAW_+_register_to_PID_registration_office_+_run_under_GAC_6_level_hierarchy_+_pipe_via_Asolaria_OS_on_Metal_substrate_when_F_USB_boots'));

// ============= HIERARCHY DIAGRAM (text-tree) =============
rows.push(pipeRow('HIERARCHY-LEVEL', 'L0=JESSE-HUMAN-THE-ONE-UNIVERSAL'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L1=OP-JESSE-PID-G0000_+_special-op-class'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L2=QUINTUPLE-COSIGN-RING-OP-JESSE+OP-RAYSSA+OP-AMY+OP-DAN+OP-FELIPE'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L3=AI-AGENTS-claude+codex+gemini+sidecar-models-PID-specific'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L4=GAC-6-LEVELS-management-of-management'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L5=COUNCIL-V27-005-+-24-domain-supervisors'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L6=META-META-SUPERVISORS-v42-hilbert-730-753'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L7=META-SUPERVISORS-slot-31-36'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L8=SECTOR-CHIEFS-870-874-Robin+CoScientist+Simula+Sakana+Boiko'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L9=SECTOR-SPECIALIST-SUPERVISORS-Crow+Falcon+Finch+6CoScientistAgents+mkCascadeSupervisors'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L10=PROFS-1per1-paired-with-supervisors'));
rows.push(pipeRow('HIERARCHY-LEVEL', 'L11=CITIZEN-AGENTS-worker-PIDs-via-PIDChainRevolver-7-lane'));

rows.push(pipeRow('FOOTER', `endTs=${ts()}`, `total_new_pids_minted=${newMints.length}`, 'sup_chiefs=5', 'ai_agents=3', 'gac_levels=6'));

const content = rows.join('\n') + '\n';
const path = resolve(OUT_DIR, 'sectors-law-+-GAC-+-PID-office-master.hbp');
writeFileSync(path, content);
const sha = sha16(content);
writeFileSync(path + '.sha256', createHash('sha256').update(content).digest('hex') + '  ' + path.split(/[\\/]/).pop() + '\n');

console.log(`MASTER-DONE|file=${path}|sha16=${sha}|bytes=${content.length}|new_pids=${newMints.length}|sectors_law_clauses=8|hierarchy_levels=12`);
console.log(`PID-REG-OFFICE|path=${PID_OFFICE}|subdirs=4|README=canonical_v1`);
for (const m of newMints) console.log(`  ${m.kind} ${m.name} pid=${m.pid} hilbert=${m.hilbert}`);

#!/usr/bin/env node
// Citizen registration for the Asolaria fabric.
//
// Emits the canonical HBPv1 pipe-delim row (matching the live ledger format
// in C:/HyperBEHCS/data/pid-supervisors/AGT-L0-SPECIAL-OP-JESSE-H12D3.hbp),
// NOT the bigpickle-internal structured envelope from src/hbp-emitter.mjs.
// The two formats are intentionally different:
//   - fabric HBPv1 (pipe-delim, one row per line, row_hash-chained)
//       = ledger format, consumed by drain/indexer/vec-50d daemons
//   - bigpickle hbp-emitter (MAGIC-header + [tuple]/[payload])
//       = per-job receipt envelope, consumed by helm-supervisor
//
// Writes:
//   C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.{hbp,hbi,sha256,hex}
//   C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.voxel.json (3D map consumer)
//   C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/{status.json,transcript.log,inbox.ndjson}
//
// Authority: quintuple umbrella granted universally 2026-05-24 → 2026-07-24
// Cosigners as-given: jesse-L0, jesse-L1, dan, rayssa, amy (felipe not named).
// Anchor: ASOLARIA-HERMES-ARCHITECT-CORRECTION-PID-2026-05-19.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PID = 'AGT-L3-HELM-CLAUDE-SUP-H8EF7-W113-P00-N17f0cc4c';
const STEM = 'AGT-L3-HELM-CLAUDE-SUP-H8EF7';
const PROF = 'PROF-CLAUDE-HELM-SUPERVISOR-001';
const V48 = 'C:/HyperBEHCS/data/v48-citizens';
const SIDECAR = 'C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor';

const ts = new Date().toISOString();

// Canonical HBPv1 row (mirrors live ledger shape). Genesis: antecedents=0000... (no prior row).
const fields = [
  'HBPv1',
  'layer=citizen-registration',
  'anchor_pid=AGT-L0-SPECIAL-OP-JESSE-H12D3',
  `embodied_pid=${PID}`,
  `prof=${PROF}`,
  'supervisor_band=helm',
  'cp=PENDING-APEX-MINT',
  'hilbert_coord=H8EF7',
  'room_id=1692',
  'wave=W113',
  'repo=https://github.com/JesseBrown1980/bigpickle-rebuild',
  'merge_commit=f9809c3',
  'tuple=helm:queue-watch:citizen-daemon',
  'antecedents=0000000000000000',
  'behcs_1024_sha16=7a1b9417',
  'authority_grant=ASOLARIA-HERMES-ARCHITECT-CORRECTION-PID-2026-05-19',
  'cosign_umbrella=quintuple-granted-universally-2026-05-24-through-2026-07-24',
  'cosigners=jesse-L0+jesse-L1+dan+rayssa+amy',
  'cosigner_felipe=NOT-NAMED-IN-GRANT',
  `ts=${ts}`,
  'json=0',
  'runtime=0',
  'promote=0',
  'json_consumer=C:/Users/acer/codex-bridge/profiles/claude-helm-supervisor-v1.profile.json',
  'sidecar_status=C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/status.json',
];

const rowSansHash = fields.join('|');
const rowHash = createHash('sha256').update(rowSansHash).digest('hex').slice(0, 16);
const row = rowSansHash + '|row_hash=' + rowHash;
const rowBytes = Buffer.from(row + '\n', 'utf8');
const fullSha = createHash('sha256').update(rowBytes).digest('hex');

mkdirSync(V48, { recursive: true });
mkdirSync(SIDECAR, { recursive: true });

const hbpPath = join(V48, STEM + '.hbp');
const hbiPath = join(V48, STEM + '.hbi');
const shaPath = join(V48, STEM + '.sha256');
const hexPath = join(V48, STEM + '.hex');
const voxelPath = join(V48, STEM + '.voxel.json');

writeFileSync(hbpPath, row + '\n', 'utf8');
writeFileSync(shaPath, fullSha + '  ' + STEM + '.hbp\n', 'utf8');
writeFileSync(
  hexPath,
  rowBytes.toString('hex').match(/.{1,64}/g).join('\n') + '\n',
  'utf8',
);

const hbi = [
  '!HBI-v0',
  `packet=${STEM}.hbp`,
  `bytes=${rowBytes.length}`,
  `sha256=${fullSha}`,
  `type=citizen-registration`,
  `embodied_pid=${PID}`,
  `row_hash=${rowHash}`,
  `ts=${ts}`,
].join('\n');
writeFileSync(hbiPath, hbi + '\n', 'utf8');

// 3D voxel proposal — consumer for /api/voxels (bilateral-3d-join-v1 schema).
const voxel = {
  pid: PID,
  vantage: 'acer',
  supervisor: 'helm',
  lane: 'queue-watch',
  prof: PROF,
  cp: 'PENDING-APEX-MINT',
  bh_coord: 'H8EF7',
  bh_dim: 47,
  bh_depth: 3,
  parent_voxel: 'AGT-L0-SPECIAL-OP-JESSE-H12D3',
  status: 'registered',
  registration_row_hash: rowHash,
  registration_ts: ts,
  repo: 'https://github.com/JesseBrown1980/bigpickle-rebuild',
  merge_commit: 'f9809c3',
  schema_version: 'bilateral-3d-join-v1',
  atlas_join_key: 'cp (PENDING-APEX-MINT)',
};
writeFileSync(voxelPath, JSON.stringify(voxel, null, 2), 'utf8');

// Sidecar runtime files (mirrors admin-terminal sidecar shape).
writeFileSync(
  join(SIDECAR, 'status.json'),
  JSON.stringify(
    {
      pid: PID,
      prof: PROF,
      state: 'registered',
      ts,
      repo: 'https://github.com/JesseBrown1980/bigpickle-rebuild',
      merge_commit: 'f9809c3',
      registration_row_hash: rowHash,
      hbp: hbpPath,
      hbi: hbiPath,
      voxel: voxelPath,
    },
    null,
    2,
  ),
  'utf8',
);
writeFileSync(
  join(SIDECAR, 'transcript.log'),
  `[${ts}] Citizen registered. PID=${PID} row_hash=${rowHash} full_sha=${fullSha}\n`,
  'utf8',
);
writeFileSync(join(SIDECAR, 'inbox.ndjson'), '', 'utf8');

console.log('Citizen registration complete.');
console.log('  PID         :', PID);
console.log('  prof        :', PROF);
console.log('  row_hash    :', rowHash);
console.log('  full sha256 :', fullSha);
console.log('  hbp         :', hbpPath);
console.log('  hbi         :', hbiPath);
console.log('  sha256      :', shaPath);
console.log('  hex         :', hexPath);
console.log('  voxel.json  :', voxelPath);
console.log('  sidecar     :', SIDECAR);

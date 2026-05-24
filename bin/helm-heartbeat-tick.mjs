#!/usr/bin/env node
// Heartbeat tick for the claude-helm-supervisor-v1 citizen ledger.
//
// Appends ONE canonical HBPv1 row to the citizen .hbp file, chained by
// row_hash to the previous row's hash (mirrors the L0-Special-OP-Jesse
// heartbeat pattern at C:/HyperBEHCS/data/pid-supervisors/AGT-L0-*.hbp).
//
// Each tick records a snapshot of acer-local fabric pipe health so that
// later replay can show whether the citizen has been seeing the pipes
// it depends on. NOT a hookwall canonical event — pure observability
// heartbeat, labeled as such.
//
// Run manually: `node bin/helm-heartbeat-tick.mjs`
// Schedule:     Windows Task Scheduler / cron / supervisor-loop every 60s
//
// Side effects (all reversible by truncating the .hbp + recomputing sidecars):
//   - Appends one line to C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp
//   - Rewrites C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.{sha256,hex,hbi}
//   - Rewrites C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/status.json with last_tick

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const HBP = 'C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp';
const HBI = 'C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbi';
const SHA = 'C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.sha256';
const HEX = 'C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hex';
const STATUS = 'C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/status.json';
const PID = 'AGT-L3-HELM-CLAUDE-SUP-H8EF7-W113-P00-N17f0cc4c';

function readLines() {
  return readFileSync(HBP, 'utf8').split('\n').filter((l) => l.length > 0);
}

function rowHashOf(line) {
  const m = line.match(/\|row_hash=([a-f0-9]{16})$/);
  if (!m) throw new Error(`row missing row_hash: ${line.slice(0, 80)}...`);
  return m[1];
}

function tickNumber(lines) {
  // tick = count of heartbeat-tick rows already in the file (next tick = count+1)
  return lines.filter((l) => l.includes('|layer=heartbeat-tick|')).length + 1;
}

async function probeHealth(port) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: ac.signal });
    return await res.json();
  } catch {
    return { ok: false, err: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const lines = readLines();
  const prevHash = rowHashOf(lines[lines.length - 1]);
  const tick = tickNumber(lines);
  const ts = new Date().toISOString();

  const ports = [4920, 4921, 4922, 4923, 4924];
  const snapshots = {};
  for (const p of ports) {
    const h = await probeHealth(p);
    snapshots[`d${p}_ok`] = h.ok ? 1 : 0;
    if (p === 4920 && h.ingest_total != null) snapshots[`d${p}_ingest_total`] = h.ingest_total;
    if (p === 4920 && h.total_processed != null)
      snapshots[`d${p}_total_processed`] = h.total_processed;
    if (p === 4921 && h.mints_total != null) snapshots[`d${p}_mints_total`] = h.mints_total;
    if (p === 4922 && h.indexed_total != null) snapshots[`d${p}_indexed_total`] = h.indexed_total;
    if (p === 4923 && h.wave_count != null) snapshots[`d${p}_wave_count`] = h.wave_count;
    if (p === 4924 && h.indexed_total != null) snapshots[`d${p}_indexed_total`] = h.indexed_total;
  }

  const fields = [
    'HBPv1',
    'layer=heartbeat-tick',
    'anchor_pid=AGT-L0-SPECIAL-OP-JESSE-H12D3',
    `embodied_pid=${PID}`,
    'prof=PROF-CLAUDE-HELM-SUPERVISOR-001',
    `tick=${tick}`,
    `antecedents=${prevHash}`,
    `ts=${ts}`,
    'NOT_a_hookwall_event=true',
    'fixture_purpose=observability-heartbeat',
    ...Object.entries(snapshots).map(([k, v]) => `${k}=${v}`),
    'json=0',
    'runtime=0',
    'promote=0',
  ];

  const sansHash = fields.join('|');
  const rowHash = createHash('sha256').update(sansHash).digest('hex').slice(0, 16);
  const row = sansHash + '|row_hash=' + rowHash;

  appendFileSync(HBP, row + '\n', 'utf8');

  const whole = readFileSync(HBP);
  const fullSha = createHash('sha256').update(whole).digest('hex');
  writeFileSync(SHA, fullSha + '  AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp\n', 'utf8');
  writeFileSync(HEX, whole.toString('hex').match(/.{1,64}/g).join('\n') + '\n', 'utf8');

  const newLines = readLines();
  const hbi = [
    '!HBI-v0',
    'packet=AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp',
    `bytes=${whole.length}`,
    `sha256=${fullSha}`,
    'type=citizen-ledger-multi-row',
    `embodied_pid=${PID}`,
    `row_count=${newLines.length}`,
    `last_row_hash=${rowHash}`,
    `last_row_layer=heartbeat-tick`,
    `last_tick=${tick}`,
    `last_ts=${ts}`,
  ].join('\n');
  writeFileSync(HBI, hbi + '\n', 'utf8');

  const status = JSON.parse(readFileSync(STATUS, 'utf8'));
  status.last_tick = tick;
  status.last_tick_ts = ts;
  status.last_tick_row_hash = rowHash;
  status.full_sha256 = fullSha;
  status.hbp_row_count = newLines.length;
  status.pipe_snapshot = snapshots;
  writeFileSync(STATUS, JSON.stringify(status, null, 2), 'utf8');

  console.log(`tick=${tick} row_hash=${rowHash}`);
  console.log(`  antecedents : ${prevHash}`);
  console.log(`  full sha256 : ${fullSha}`);
  console.log(`  row_count   : ${newLines.length}`);
  console.log(`  snapshot    : ${JSON.stringify(snapshots)}`);
})();

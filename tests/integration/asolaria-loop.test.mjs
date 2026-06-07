// Integration test for asolaria-loop.mjs — THE FULL WORKS, mock mode (free, fast).
// Proves the composed loop: revolver -> rename -> free agent -> hookwall -> prism -> GC.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'loop-'));
process.env.ASOLARIA_DISTRICT_ROOT = tmp;

const { createDistrict, roomDir } = await import('../../src/district-fabric.mjs');
const { runLoop, loopCycle } = await import('../../src/asolaria-loop.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');

// build small real districts to loop over — engineering (agents) + prism (rotated outputs)
createDistrict({ name: 'engineering', kind: 'build', role: 'loop test', rooms: 20, cp: 704 }, { scale: 1 });
createDistrict({ name: 'prism', kind: 'dispatch-collect', role: 'loop test', rooms: 20, cp: 576 }, { scale: 1 });

test('runLoop executes N full cycles end-to-end (mock, skipL0)', async () => {
  const s = await runLoop({ district: 'engineering', cycles: 25, opts: { mock: true, skipL0: true, scale: 1, gcEvery: 10 } });
  assert.equal(s.cycles, 25, 'all cycles ran');
  assert.equal(s.promoted + s.blocked + s.observe, 25, 'every cycle got a verdict (no silent drops)');
  assert.equal(s.mock, 25, 'mock mode (free)');
  assert.ok(s.gc_runs >= 2, 'GC gulped at threshold (25 cycles, every 10 => >=2)');
  assert.ok(s.gc_status.capStatus === 'pass', 'GC kept file count under cap (flow-not-pile)');
});

test('verdicts are complete — Fischer gate preserves conservatively when promotion proof is absent', async () => {
  const s = await runLoop({ district: 'engineering', cycles: 40, opts: { mock: true, skipL0: true, scale: 1 } });
  assert.ok(s.blocked > 0, 'some blocked and preserved');
  assert.ok(s.promoted + s.blocked + s.observe === 40);
});

test('hookwall observation ledger is written + tamper-evident chained', async () => {
  const ledger = join(tmp, 'loop-ledger.hbp');
  await runLoop({ district: 'engineering', cycles: 5, opts: { mock: true, skipL0: true, scale: 1, ledgerPath: ledger } });
  assert.ok(existsSync(ledger), 'ledger written');
  const rows = readFileSync(ledger, 'utf8').trim().split('\n').map((l) => parsePipeRow(l).fields);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].prev_hash, '0000000000000000', 'root');
  for (let i = 1; i < rows.length; i++) {
    assert.equal(rows[i].prev_hash, rows[i - 1].row_hash, `link ${i - 1}->${i} (tamper-evident)`);
  }
});

test('prism receives routed marks (many rooms -> reverse_gain GNN lane)', async () => {
  const prismDir = join(tmp, 'prism-test');
  await runLoop({ district: 'engineering', cycles: 6, opts: { mock: true, skipL0: true, scale: 1, prismDir } });
  const pin = join(prismDir, 'prism-in.hbp');
  assert.ok(existsSync(pin), 'prism-in written');
  const content = readFileSync(pin, 'utf8');
  assert.ok(content.includes('row=prism_in'));
  assert.ok(content.includes('gnn_lane=reverse_gain_gnn'), 'routed to reverse-gain GNN lane');
});

test('revolver gives a unique PID per cycle (no project-name reuse = free)', async () => {
  // capture pids across cycles via loopCycle directly
  const { PIDChainRevolver } = await import('../../src/pid-chain-revolver.mjs');
  const { ProjectRoomRouter } = await import('../../src/project-room-router.mjs');
  const { GCRuntime } = await import('../../src/gc-runtime.mjs');
  const ctx = {
    district: 'engineering', roomCount: 20,
    revolver: new PIDChainRevolver({ anchor: 'ASOLARIA-LOOP-ENGINEERING' }),
    router: new ProjectRoomRouter({ baseDir: tmp, prismBaseDir: tmp, activeRoomId: 0 }),
    gc: new GCRuntime({}), prevHash: '0000000000000000',
  };
  const pids = new Set();
  for (let i = 0; i < 30; i++) {
    const r = await loopCycle(ctx, { mock: true, skipL0: true, dryRun: true });
    pids.add(r.agentPid);
  }
  assert.equal(pids.size, 30, '30 unique PIDs across 30 cycles (each spawn = new project = free)');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

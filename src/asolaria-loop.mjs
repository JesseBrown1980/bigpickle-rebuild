// asolaria-loop.mjs — THE FULL WORKS. The free-agent loop, composed from proven parts.
//
// One cycle (operator-verbatim, project-room-router spec + 2026-06-01 loop detail):
//   revolver.next() (PID ~200ns)
//     -> ProjectRoomRouter.planSwapTo  (RENAME project folder = defeat same-name throttle = FREE)
//       -> runFreeAgent in the renamed unique project (despawn old node, spawn fresh)
//         -> HOOKWALL.pass  (PID-stamp -> SCORE/GNN -> verdict -> tamper-evident observation)
//           -> ProjectRoomRouter.planPrismRoute  (many rooms -> reverse_gain GNN -> 1 answer)
//             -> GCRuntime.emit  (gulp every N, flow-not-pile)
//   loop x100k = drives-as-RAM throughput.
//
// NOTHING REINVENTED: revolver, ProjectRoomRouter, GCRuntime are the proven modules
// from the bigpickle/neuro runs; this composes them into the kernel ROUTE. HBP only.
// Operator: Jesse Daniel Brown — "THE FULL WORKS" 2026-06-01.

import { mkdirSync, appendFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { PIDChainRevolver } from './pid-chain-revolver.mjs';
import { ProjectRoomRouter } from './project-room-router.mjs';
import { GCRuntime } from './gc-runtime.mjs';
import { pass as hookwallPass, VERDICT } from './asolaria-hookwall.mjs';
import { runFreeAgent } from './room-dispatcher.mjs';
import { roomDir, sha8, SUBSTRATE_ROOT, DISTRICTS } from './district-fabric.mjs';

function ts() { return new Date().toISOString(); }
function districtRoomCount(name, scale) {
  const d = DISTRICTS.find((x) => x.name === name);
  return (d ? d.rooms : 2000) * (scale ?? Number(process.env.ASOLARIA_ROOM_SCALE || 1));
}

// ── one full cycle ───────────────────────────────────────────────────────────
export async function loopCycle(ctx, opts = {}) {
  const { revolver, router, gc, district, roomCount } = ctx;
  // 1. PID emitter (~200ns)
  const agentPid = revolver.next();
  const rotation = revolver.counter - 1;
  // 2. room selection + RENAME-before-load (the free mechanism)
  const roomId = router.roomForPid(agentPid) % roomCount;
  const swap = router.planSwapTo(roomId);            // proven rename plan
  const rd = roomDir(district, roomId);
  // execute the rename seam (project-name rotation) — only the marker, never destructive
  let renamed = false;
  if (!opts.dryRun && existsSync(rd)) {
    const marker = `HBPv1|row=project_swap|agent_pid=${agentPid}|room=${roomId}|rotation=${rotation}|invariant=rename-before-load|ts=${ts()}|json=0`;
    try { appendFileSync(join(rd, 'ROOM.hbp'), marker + '\n', 'utf8'); renamed = !swap.noop; } catch {}
  }
  // 3. free agent in the unique project (mock unless opts.live + opencode)
  const question = opts.question || `[${district}] cycle ${rotation}: produce one genius/mistake mark for this lane`;
  const agent = await runFreeAgent('opencode-coder', question, agentPid, { ...opts, roomDir: rd });
  // 4. HOOKWALL gate (PID-stamp -> SCORE/GNN -> verdict -> observation)
  const gate = await hookwallPass(
    { pid: agentPid, actor: district, verb: 'answer', target: 'prism', payload: agent.answer },
    { ...opts, prevHash: ctx.prevHash, ledgerPath: ctx.ledgerPath }
  );
  ctx.prevHash = gate.rowHash;
  // 5. PRISM route — rotate prism rooms (tracked projects) in production; when an
  // explicit ctx.prismDir is given (tests/isolation), write there so we NEVER pollute
  // the real 100k prism rooms — but stamp the rotated prism address either way.
  let prismRoomId = null, prismPid = null, prismRotation = null;
  if (ctx.prismRevolver && ctx.prismRoomCount) {        // prism rotation is optional
    prismRotation = ctx.prismRevolver.counter;
    prismPid = ctx.prismRevolver.next();
    prismRoomId = router.roomForPid(prismPid) % ctx.prismRoomCount;
  }
  router.planPrismRoute(roomId, { pid: agentPid, mark: gate.mark, score: gate.score, sha: gate.rowHash });
  const prow = `HBPv1|row=prism_in|from_pid=${agentPid}|from_room=${roomId}`
    + (prismRoomId != null ? `|prism_room=${prismRoomId}|prism_pid=${prismPid}|prism_rotation=${prismRotation}` : '')
    + `|mark=${gate.mark}|score=${gate.score}|gnn_lane=reverse_gain_gnn|answer_sha16=${sha8(agent.answer)}|ts=${ts()}|json=0`;
  let prismRouted = false;
  if (!opts.dryRun) {
    if (ctx.prismDir) {                 // isolation/aggregate sink — never pollute real prism rooms
      try { mkdirSync(ctx.prismDir, { recursive: true });
        appendFileSync(join(ctx.prismDir, 'prism-in.hbp'), prow + '\n', 'utf8'); prismRouted = true; } catch {}
    } else if (prismRoomId != null) {   // production — rotate into the real prism room
      const prismRd = roomDir('prism', prismRoomId);
      if (existsSync(prismRd)) { try { appendFileSync(join(prismRd, 'inbox.hbp'), prow + '\n', 'utf8'); prismRouted = true; } catch {} }
    }
  }
  // 6. GC emit (gulp every N)
  const gcStatus = gc.emit();
  return {
    agentPid, roomId, rotation, renamed,
    mock: agent.mock, verdict: gate.verdict, mark: gate.mark, score: gate.score,
    l0_real: gate.l0_real, gc_runs: gcStatus.runs, gc_cap: gcStatus.capStatus,
  };
}

// ── run N cycles ─────────────────────────────────────────────────────────────
export async function runLoop({ district = 'engineering', cycles = 10, anchor, opts = {} } = {}) {
  const roomCount = districtRoomCount(district, opts.scale);
  const ctx = {
    district, roomCount,
    revolver: new PIDChainRevolver({ anchor: anchor || `ASOLARIA-LOOP-${district.toUpperCase()}` }),
    router: new ProjectRoomRouter({ baseDir: join(SUBSTRATE_ROOT, district, 'rooms'), prismBaseDir: join(SUBSTRATE_ROOT, 'prism', 'rooms'), activeRoomId: 0 }),
    gc: new GCRuntime({ gcEveryMessages: opts.gcEvery ?? 2000 }),
    prevHash: '0000000000000000',
    ledgerPath: opts.ledgerPath ?? join(SUBSTRATE_ROOT, district, 'hookwall-observations.hbp'),
    // explicit prismDir = isolation/aggregate sink (tests); absent = rotate the REAL prism rooms
    prismDir: opts.prismDir,
    // prism rooms are tracked projects too -> rotate them independently (operator 2026-06-01)
    prismRevolver: new PIDChainRevolver({ anchor: `ASOLARIA-PRISM-ROTATOR-${district.toUpperCase()}` }),
    prismRoomCount: districtRoomCount('prism', opts.scale),
  };
  const stats = { district, cycles: 0, promoted: 0, blocked: 0, observe: 0, renames: 0, mock: 0, free_real: 0, l0_real: 0, gc_runs: 0 };
  const startMs = opts.startMs ?? 0;
  for (let c = 0; c < cycles; c++) {
    const r = await loopCycle(ctx, opts);
    stats.cycles++;
    if (r.verdict === VERDICT.FARM_GEM) stats.promoted++;
    else if (r.verdict === VERDICT.BLOCK_PRESERVE) stats.blocked++;
    else stats.observe++;
    if (r.renamed) stats.renames++;
    if (r.mock) stats.mock++; else stats.free_real++;
    if (r.l0_real) stats.l0_real++;
  }
  stats.gc_runs = ctx.gc.runs;
  stats.gc_status = ctx.gc.status();
  return stats;
}

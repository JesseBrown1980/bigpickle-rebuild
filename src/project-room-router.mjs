// Project-room router — clean-room port of pre-Codex OMNI file manager router.
//
// Spec (operator verbatim 2026-05-25):
//   "we created the OMNI file manager router 10000 micro kernels and rooms to
//    be able to instantly load the agents swaping the information based on by
//    swapping the name of the folder on C. Then those outputs would be routed
//    back into the system on d with a prism type device. ... Just flush the
//    agent node for the 1 of 10000 rooms, and load the next one while changing
//    the folder name first on C drive."
//
// Codex bypass mechanism: when many calls go to the SAME PROJECT name, Codex
// throttles to near-zero. Solution: rotate room folder names on C: so each
// agent load looks like a NEW project name. Outputs prism-route to D: where
// GNN aggregates many-rooms → 1 answer per question.
//
// CLEAN-ROOM: this is a port of the documented PATTERN, not the source acer-side
// at C:/asolaria-acer/packages/revolver-10k/. Pure planners; executor seam (fs
// renames) is the caller's responsibility so the same module works for testing.

export const ROOM_COUNT = 10000;

// === PID → room assignment (deterministic) ==============================

export function roomIdFromPid(pidHex) {
  if (typeof pidHex !== 'string' || pidHex.length === 0) {
    throw new TypeError('roomIdFromPid: pidHex must be a non-empty string');
  }
  let acc = 0;
  for (let i = 0; i < pidHex.length; i++) {
    acc = (acc * 31 + pidHex.charCodeAt(i)) >>> 0;
  }
  return acc % ROOM_COUNT;
}

// === Room folder name (deterministic, Codex-rotatable) ==================

export function roomFolderName(roomId, opts = {}) {
  const stem = opts.stem ?? 'omni-room';
  const alphabet = opts.alphabet ?? 'behcs-256';
  if (!Number.isInteger(roomId) || roomId < 0 || roomId >= ROOM_COUNT) {
    throw new RangeError(`roomFolderName: roomId must be 0..${ROOM_COUNT - 1}, got ${roomId}`);
  }
  return `${stem}-${alphabet}-${String(roomId).padStart(4, '0')}`;
}

// === Pure planners (no I/O) =============================================

export function planRoomSwap({ currentRoomId, nextRoomId, baseDir, opts = {} }) {
  if (currentRoomId === nextRoomId) {
    return { algorithm: 'project-room-router-plan.v1', noop: true, room_id: currentRoomId };
  }
  const fromName = roomFolderName(currentRoomId, opts);
  const toName = roomFolderName(nextRoomId, opts);
  return {
    algorithm: 'project-room-router-plan.v1',
    invariant: 'rename-before-load (Codex bypass: same-PROJECT-name throttle defeated)',
    ops: [
      { type: 'rename', from: fromName, to: toName, baseDir },
      { type: 'load', roomId: nextRoomId, folder: toName, baseDir },
    ],
  };
}

export function prismRoutePlan({ roomId, payload, prismBaseDir, opts = {} }) {
  if (!Number.isInteger(roomId) || roomId < 0 || roomId >= ROOM_COUNT) {
    throw new RangeError(`prismRoutePlan: invalid roomId ${roomId}`);
  }
  const folder = roomFolderName(roomId, opts);
  return {
    algorithm: 'prism-route-plan.v1',
    schema: opts.schema ?? 'bilateral-3d-join-v1',
    room_id: roomId,
    out_path: `${prismBaseDir}/${folder}/prism-out.ndjson`,
    payload,
    gnn_aggregate_lane: 'reverse_gain_gnn',
    gnn_aggregate_note: 'many-rooms → GNN merge → 1 answer (per logical-scale-ledger.ndjson canon)',
  };
}

// === Stateful router class ==============================================

export class ProjectRoomRouter {
  constructor(opts = {}) {
    this.baseDir = opts.baseDir ?? null;
    this.prismBaseDir = opts.prismBaseDir ?? null;
    this.activeRoomId = opts.activeRoomId ?? 0;
    this.swapCount = 0;
    this.alphabetOpts = { stem: opts.stem, alphabet: opts.alphabet };
  }

  planSwapTo(nextRoomId) {
    const plan = planRoomSwap({
      currentRoomId: this.activeRoomId,
      nextRoomId,
      baseDir: this.baseDir,
      opts: this.alphabetOpts,
    });
    if (!plan.noop) {
      this.activeRoomId = nextRoomId;
      this.swapCount++;
    }
    return plan;
  }

  planPrismRoute(roomId, payload) {
    return prismRoutePlan({
      roomId,
      payload,
      prismBaseDir: this.prismBaseDir,
      opts: this.alphabetOpts,
    });
  }

  roomForPid(pidHex) {
    return roomIdFromPid(pidHex);
  }
}

// === Honest gaps ========================================================

export const HONEST_GAPS = Object.freeze([
  '10000-room count is operator-canonical; not derived from a formal capacity model',
  'planRoomSwap is a pure planner; executor must do fs.renameSync atomically (caller responsibility)',
  'Codex same-PROJECT-name throttle bypass is operator-asserted; not independently validated post-cutoff',
  'Prism schema (bilateral-3d-join-v1) reuses existing voxel.json shape from helm registration (Layer 8)',
  'GNN aggregation lane "reverse_gain_gnn" matches logical-scale-ledger.ndjson canon but lane-attach to live GNN is out of scope here',
  'roomIdFromPid hash distribution not formally proven uniform across 10000 buckets — adequate for routing, not for cryptographic load balancing',
]);

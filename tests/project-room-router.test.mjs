// Unit tests for project-room-router — 10000-room Codex-bypass pattern.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_COUNT,
  roomIdFromPid,
  roomFolderName,
  planRoomSwap,
  prismRoutePlan,
  ProjectRoomRouter,
  HONEST_GAPS,
} from '../src/project-room-router.mjs';

// === ROOM_COUNT canon =====================================================

test('ROOM_COUNT is 10000 (operator-canonical)', () => {
  assert.equal(ROOM_COUNT, 10000);
});

// === roomIdFromPid ========================================================

test('roomIdFromPid is deterministic for same input', () => {
  const a = roomIdFromPid('a1b2c3d4e5f60718');
  const b = roomIdFromPid('a1b2c3d4e5f60718');
  assert.equal(a, b);
});

test('roomIdFromPid stays in [0, 9999]', () => {
  for (const pid of ['0', 'ffff', 'a1b2c3d4e5f60718', 'AGT-L3-HELM-CLAUDE-SUP-H8EF7', '0000000000000000']) {
    const id = roomIdFromPid(pid);
    assert.ok(id >= 0 && id < ROOM_COUNT, `${pid} → ${id} out of range`);
  }
});

test('roomIdFromPid distributes across many rooms (statistical)', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    seen.add(roomIdFromPid(`pid-${i}-${i * 7}`));
  }
  // 200 distinct pids should hit >> 10 distinct rooms (extremely loose)
  assert.ok(seen.size > 50, `expected wide distribution, got ${seen.size}/200 unique`);
});

test('roomIdFromPid throws on invalid input', () => {
  assert.throws(() => roomIdFromPid(''), TypeError);
  assert.throws(() => roomIdFromPid(null), TypeError);
  assert.throws(() => roomIdFromPid(123), TypeError);
});

// === roomFolderName =======================================================

test('roomFolderName formats with default stem + alphabet + 4-digit padding', () => {
  assert.equal(roomFolderName(0), 'omni-room-behcs-256-0000');
  assert.equal(roomFolderName(42), 'omni-room-behcs-256-0042');
  assert.equal(roomFolderName(9999), 'omni-room-behcs-256-9999');
});

test('roomFolderName accepts custom stem + alphabet', () => {
  assert.equal(
    roomFolderName(7, { stem: 'micro-kernel', alphabet: 'behcs-1024' }),
    'micro-kernel-behcs-1024-0007',
  );
});

test('roomFolderName throws out of range', () => {
  assert.throws(() => roomFolderName(-1), RangeError);
  assert.throws(() => roomFolderName(10000), RangeError);
  assert.throws(() => roomFolderName(1.5), RangeError);
  assert.throws(() => roomFolderName('x'), RangeError);
});

// === planRoomSwap (pure) ==================================================

test('planRoomSwap returns noop when current === next', () => {
  const p = planRoomSwap({ currentRoomId: 5, nextRoomId: 5, baseDir: '/tmp' });
  assert.equal(p.noop, true);
  assert.equal(p.room_id, 5);
});

test('planRoomSwap ops are [rename, load] in that order (rename-FIRST invariant)', () => {
  const p = planRoomSwap({ currentRoomId: 5, nextRoomId: 6, baseDir: '/tmp' });
  assert.equal(p.algorithm, 'project-room-router-plan.v1');
  assert.match(p.invariant, /rename-before-load/);
  assert.equal(p.ops.length, 2);
  assert.equal(p.ops[0].type, 'rename');
  assert.equal(p.ops[1].type, 'load');
  assert.equal(p.ops[0].from, 'omni-room-behcs-256-0005');
  assert.equal(p.ops[0].to, 'omni-room-behcs-256-0006');
  assert.equal(p.ops[1].roomId, 6);
});

test('planRoomSwap respects custom alphabet opts', () => {
  const p = planRoomSwap({
    currentRoomId: 0,
    nextRoomId: 1,
    baseDir: '/tmp',
    opts: { stem: 'mk', alphabet: 'behcs-1024' },
  });
  assert.equal(p.ops[0].from, 'mk-behcs-1024-0000');
  assert.equal(p.ops[0].to, 'mk-behcs-1024-0001');
});

// === prismRoutePlan =======================================================

test('prismRoutePlan produces D-side out_path with payload + GNN lane', () => {
  const r = prismRoutePlan({
    roomId: 42,
    payload: { event: 'answer', q: 'q1' },
    prismBaseDir: 'D:/asolaria-liris-mirror',
  });
  assert.equal(r.algorithm, 'prism-route-plan.v1');
  assert.equal(r.schema, 'bilateral-3d-join-v1');
  assert.equal(r.room_id, 42);
  assert.equal(r.out_path, 'D:/asolaria-liris-mirror/omni-room-behcs-256-0042/prism-out.ndjson');
  assert.deepEqual(r.payload, { event: 'answer', q: 'q1' });
  assert.equal(r.gnn_aggregate_lane, 'reverse_gain_gnn');
});

test('prismRoutePlan throws on invalid roomId', () => {
  assert.throws(() => prismRoutePlan({ roomId: -1, payload: {}, prismBaseDir: '/x' }), RangeError);
  assert.throws(() => prismRoutePlan({ roomId: 10000, payload: {}, prismBaseDir: '/x' }), RangeError);
});

// === ProjectRoomRouter (stateful) =========================================

test('ProjectRoomRouter starts at roomId 0 by default', () => {
  const r = new ProjectRoomRouter();
  assert.equal(r.activeRoomId, 0);
  assert.equal(r.swapCount, 0);
});

test('ProjectRoomRouter.planSwapTo advances state on non-noop swap', () => {
  const r = new ProjectRoomRouter({ baseDir: '/c', prismBaseDir: '/d' });
  const p1 = r.planSwapTo(5);
  assert.equal(r.activeRoomId, 5);
  assert.equal(r.swapCount, 1);
  assert.equal(p1.ops[1].roomId, 5);

  const p2 = r.planSwapTo(5);
  assert.equal(p2.noop, true);
  assert.equal(r.swapCount, 1, 'noop must not bump swapCount');

  const p3 = r.planSwapTo(9999);
  assert.equal(r.activeRoomId, 9999);
  assert.equal(r.swapCount, 2);
  assert.equal(p3.ops[0].from, 'omni-room-behcs-256-0005');
  assert.equal(p3.ops[0].to, 'omni-room-behcs-256-9999');
});

test('ProjectRoomRouter.roomForPid delegates to roomIdFromPid', () => {
  const r = new ProjectRoomRouter();
  assert.equal(r.roomForPid('a1b2c3d4e5f60718'), roomIdFromPid('a1b2c3d4e5f60718'));
});

test('ProjectRoomRouter.planPrismRoute carries router-configured baseDir', () => {
  const r = new ProjectRoomRouter({ baseDir: '/c', prismBaseDir: 'D:/prism' });
  const route = r.planPrismRoute(7, { msg: 'hi' });
  assert.equal(route.out_path, 'D:/prism/omni-room-behcs-256-0007/prism-out.ndjson');
});

// === HONEST_GAPS canon ====================================================

test('HONEST_GAPS is frozen + documents the operator-canonical assumptions', () => {
  assert.ok(Object.isFrozen(HONEST_GAPS));
  assert.ok(HONEST_GAPS.length >= 5);
  assert.ok(HONEST_GAPS.some((g) => /10000/.test(g)));
  assert.ok(HONEST_GAPS.some((g) => /Codex/.test(g)));
  assert.ok(HONEST_GAPS.some((g) => /executor/i.test(g) || /caller/i.test(g)));
});

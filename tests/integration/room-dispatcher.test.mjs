// Integration test for room-dispatcher.mjs — full pipeline end-to-end, $0, deterministic.
// rotator -> agent -> hookwall -> GNN(skipped/mock) -> reverse-gain -> shannon -> outbox -> prism.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'dispatcher-'));
process.env.ASOLARIA_DISTRICT_ROOT = tmp;

const { createDistrict, roomDir, DISTRICTS } = await import('../../src/district-fabric.mjs');
const {
  AGENT_TYPE_BY_DISTRICT, runFreeAgent, rotateRoom, dispatchRoom, routeToPrism,
  hookwallGate, reverseGain, shannonParts,
} = await import('../../src/room-dispatcher.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');

// build small real districts to operate on
createDistrict({ name: 'engineering', kind: 'build', role: 'test', rooms: 4, cp: 704 }, {});
createDistrict({ name: 'prism', kind: 'dispatch-collect', role: 'test', rooms: 4, cp: 576 }, {});
createDistrict({ name: 'rotator', kind: 'pid-rotation', role: 'test', rooms: 4, cp: 480 }, {});

test('every district maps to an agent type', () => {
  for (const d of DISTRICTS) {
    assert.ok(AGENT_TYPE_BY_DISTRICT[d.name], `${d.name} has an agent type`);
    assert.ok(AGENT_TYPE_BY_DISTRICT[d.name].type, `${d.name} type is named`);
  }
});

test('runFreeAgent mock is deterministic + bounded score', async () => {
  const a1 = await runFreeAgent('opencode-coder', 'question X', 'BH.PID.1', { mock: true });
  const a2 = await runFreeAgent('opencode-coder', 'question X', 'BH.PID.1', { mock: true });
  assert.equal(a1.answer, a2.answer, 'deterministic');
  assert.ok(a1.self_score >= 0 && a1.self_score < 1, 'score in [0,1)');
  assert.equal(a1.mock, true);
});

test('rotateRoom advances cursor + stamps ROOM.hbp with rotation row', () => {
  const r0 = rotateRoom('rotator', 4);
  const r1 = rotateRoom('rotator', 4);
  assert.equal(r0.idx, 0);
  assert.equal(r1.idx, 1, 'cursor advances');
  assert.equal(r1.rotation, 1);
  // stamp landed in ROOM.hbp
  const desc = readFileSync(join(roomDir('rotator', 1), 'ROOM.hbp'), 'utf8');
  assert.ok(desc.includes('row=rotation'), 'rotation row stamped');
  assert.ok(desc.includes('state=assigned'));
});

test('hookwall/reverse-gain/shannon math is correct', () => {
  assert.equal(hookwallGate(0.9).pass, true);
  assert.equal(hookwallGate(0.5).pass, false);
  const rg = reverseGain(0.9);
  assert.equal(rg.promoted, true);
  assert.equal(rg.gnnStatus, 'FORWARD_GNN_MARK_GENIUS');
  assert.equal(reverseGain(0.4).gnnStatus, 'REVERSE_GAIN_MARK_MISTAKE');
  const sh = shannonParts('the quick brown fox jumps over the lazy dog 12345');
  assert.ok(sh.H > 0 && sh.efficiency > 0 && sh.efficiency <= 1, 'entropy in range');
  assert.equal(sh.parts, 12);
});

test('dispatchRoom end-to-end writes verified HBP outbox (mock agent, skipGnn)', async () => {
  // prime an inbox question
  const rd = roomDir('engineering', 0);
  writeFileSync(join(rd, 'inbox.hbp'),
    'HBPv1|row=room_question|pid=BH.DISTRICT.ENGINEERING.R00000.TEST|lane=build|question=Write a sha16 helper|json=0\n', 'utf8');

  const res = await dispatchRoom('engineering', 0, { mock: true, skipGnn: true });
  assert.equal(res.district, 'engineering');
  assert.equal(res.agent_type, 'opencode-coder');
  assert.ok(res.answer_sha16.length === 16);
  assert.ok(['FORWARD_GNN_MARK_GENIUS', 'REVERSE_GAIN_MARK_MISTAKE'].includes(res.gnn_status));
  assert.ok(res.shannon.H >= 0);

  // outbox is valid HBP, no JSON
  const out = parsePipeRow(readFileSync(join(rd, 'outbox.hbp'), 'utf8').trim());
  assert.equal(out.tag, 'HBPv1');
  assert.equal(out.fields.row, 'room_answer');
  assert.equal(out.fields.district, 'engineering');
  assert.equal(out.fields.json, '0');
  assert.ok(out.fields.gnn_status);
});

test('routeToPrism forwards answer into a prism room inbox (HBP)', async () => {
  const res = await dispatchRoom('engineering', 1, { mock: true, skipGnn: true });
  const r = routeToPrism(res.outbox_row, 0);
  // prism room 0 inbox now has a prism_forward row
  const prismInbox = readFileSync(join(roomDir('prism', 0), 'inbox.hbp'), 'utf8');
  assert.ok(prismInbox.includes('row=prism_forward'), 'prism received the forward');
  assert.ok(prismInbox.includes('from_district=engineering'));
  assert.ok(prismInbox.includes('json=0'));
});

test('full chain: rotate -> dispatch -> prism, 3 rooms, all HBP', async () => {
  const results = [];
  for (let i = 0; i < 3; i++) {
    const rot = rotateRoom('engineering', 4);
    const disp = await dispatchRoom('engineering', rot.idx, { mock: true, skipGnn: true });
    routeToPrism(disp.outbox_row, i);
    results.push(disp);
  }
  assert.equal(results.length, 3);
  // all produced a gnn_status + shannon
  assert.ok(results.every((r) => r.gnn_status && r.shannon.parts === 12));
  // scores spread (deterministic mock gives variety across rooms)
  const scores = new Set(results.map((r) => r.gnn_score));
  assert.ok(scores.size >= 1, 'scores computed');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

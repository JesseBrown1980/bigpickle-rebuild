// Tests for deep-wave-extended-integrate.mjs
// Per operator 2026-05-28T17:13Z: "omniscrcpy + omnicoder + 2TB + 128GB + 35TB google + router integration tests"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toOmniscrcpyFrame,
  toOmnicoderTask,
  to2TBSovlinuxIntake,
  to128GBLirisIntake,
  to35TBGoogleDriveSubstrate,
  toRouterDispatchPlan,
  emitFullExtendedRows,
} from '../src/deep-wave-extended-integrate.mjs';

const sampleStats = { totalPackets: 7000, totalGenius: 350, totalMistake: 350, totalNeutral: 6300 };

test('toOmniscrcpyFrame emits Falcon CDP frame pid HBPv1 row', () => {
  const row = toOmniscrcpyFrame({ cascadeId: 'tc', beatIdx: 100, deviceSerial: 'R5CXA4MGQXV' });
  assert.match(row, /^OMNISCRCPY-FRAME\|frame_pid=[a-f0-9]{16}/);
  assert.match(row, /device=R5CXA4MGQXV/);
  assert.match(row, /forward_tunnel=8790/);
  assert.match(row, /protocol=CDP/);
  assert.ok(!row.includes('{'));
});

test('toOmnicoderTask deterministic task pid + queued status', () => {
  const row1 = toOmnicoderTask({ cascadeId: 'tc', waveIdx: 0, codePrompt: 'classify-packet-x' });
  const row2 = toOmnicoderTask({ cascadeId: 'tc', waveIdx: 0, codePrompt: 'classify-packet-x' });
  assert.equal(row1, row2);
  assert.match(row1, /^OMNICODER-TASK\|task_pid=[a-f0-9]{16}/);
  assert.match(row1, /backend=local-microJS\+free-agent-portal/);
});

test('to2TBSovlinuxIntake flags operator gate required', () => {
  const row = to2TBSovlinuxIntake({ cascadeId: 'tc', packetSha16: 'deadbeef' });
  assert.match(row, /^SOVLINUX-2TB-INTAKE\|intake_pid=[a-f0-9]{16}/);
  assert.match(row, /device=Falcon-USB-2TB/);
  assert.match(row, /mount=E:/);
  assert.match(row, /mount_state=gated/);
  assert.match(row, /operator_gate_required=true/);
  assert.match(row, /signature_expected=2814414849/);
});

test('to128GBLirisIntake records 94GB unallocated waiting carve', () => {
  const row = to128GBLirisIntake({ cascadeId: 'tc', packetSha16: 'beefdead', partitionTier: 3 });
  assert.match(row, /^LIRIS-128GB-INTAKE\|intake_pid=[a-f0-9]{16}/);
  assert.match(row, /partition_tier=3/);
  assert.match(row, /unallocated_gb=94/);
  assert.match(row, /carve_pending=operator_admin/);
});

test('to35TBGoogleDriveSubstrate has correct account + free TB', () => {
  const row = to35TBGoogleDriveSubstrate({ cascadeId: 'tc', packetSha16: 'abcd1234', lane: 'memory' });
  assert.match(row, /^GOOGLE-DRIVE-35TB\|slot_pid=[a-f0-9]{16}/);
  assert.match(row, /account=plasmatoid@gmail.com/);
  assert.match(row, /plan=AI-Ultra/);
  assert.match(row, /total_TB=35/);
  assert.match(row, /free_TB=34.9/);
  assert.match(row, /adc_gate=operator_gated/);
  assert.match(row, /lane=memory/);
});

test('toRouterDispatchPlan computes slots correctly with backpressure', () => {
  const row = toRouterDispatchPlan({ cascadeId: 'tc', waveIdx: 0, packetCount: 10000, workerCount: 8 });
  assert.match(row, /^ROUTER-DISPATCH-PLAN\|plan_pid=[a-f0-9]{16}/);
  assert.match(row, /workers=8/);
  assert.match(row, /slots_required=1000/); // 10000/8 = 1250 capped at 1000
  assert.match(row, /backpressure_threshold=900_slots_used/);
});

test('toRouterDispatchPlan caps slots at 1000 (omnidispatcher max)', () => {
  const row = toRouterDispatchPlan({ cascadeId: 'tc', waveIdx: 0, packetCount: 1_000_000, workerCount: 8 });
  assert.match(row, /slots_required=1000/);
});

test('emitFullExtendedRows produces 4 rows without samplePacket', () => {
  const rows = emitFullExtendedRows({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats });
  assert.equal(rows.length, 4);
  const tags = rows.map(r => r.split('|')[0]);
  assert.ok(tags.includes('ROUTER-DISPATCH-PLAN'));
  assert.ok(tags.includes('GOOGLE-DRIVE-35TB'));
  assert.ok(tags.includes('LIRIS-128GB-INTAKE'));
  assert.ok(tags.includes('SOVLINUX-2TB-INTAKE'));
});

test('emitFullExtendedRows produces 6 rows with samplePacket (adds omniscrcpy + omnicoder)', () => {
  const packet = { pid: '00112233445566778899aabbccddeeff', beatIdx: 100 };
  const rows = emitFullExtendedRows({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats, samplePacket: packet });
  assert.equal(rows.length, 6);
  const tags = rows.map(r => r.split('|')[0]);
  assert.ok(tags.includes('OMNISCRCPY-FRAME'));
  assert.ok(tags.includes('OMNICODER-TASK'));
});

test('all extended rows are HBPv1 pipe-row format (no JSON)', () => {
  const packet = { pid: 'abc123', beatIdx: 5 };
  const rows = emitFullExtendedRows({ cascadeId: 'no-json-check', waveIdx: 0, stats: sampleStats, samplePacket: packet });
  const all = rows.join('\n');
  assert.ok(!all.includes('{'));
  assert.ok(!all.includes('}'));
  assert.ok(!all.includes('"'));
});

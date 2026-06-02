// Deep-Wave extended integration: omniscrcpy, omnicoder, USB substrates, Google Drive, router.
// Per operator 2026-05-28T17:11Z + 17:13Z directives.
// HBPv1 pipe-rows only. PID-specific throughout.

import { createHash } from 'node:crypto';

function sha16(input) {
  return createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

// ============= Omniscrcpy frame (Falcon CDP screen mirroring) =============
// Falcon is at omnicoder forward-tunnel :8790 per project_f1_f2_f3_v54_cylindrical_falcon_LIVE memory

export function toOmniscrcpyFrame({ cascadeId, beatIdx, deviceSerial, vantage = 'acer' }) {
  const framePid = sha16(`omniscrcpy|${vantage}|${cascadeId}|beat=${beatIdx}|dev=${deviceSerial}`);
  return `OMNISCRCPY-FRAME|frame_pid=${framePid}|cascade=${cascadeId}|beat=${beatIdx}|device=${deviceSerial}|vantage=${vantage}|forward_tunnel=8790|protocol=CDP`;
}

// ============= Omnicoder code-helping task =============

export function toOmnicoderTask({ cascadeId, waveIdx, codePrompt }) {
  const taskPid = sha16(`omnicoder|${cascadeId}|w${waveIdx}|${codePrompt}`);
  return `OMNICODER-TASK|task_pid=${taskPid}|cascade=${cascadeId}|wave=${waveIdx}|prompt_sha16=${sha16(codePrompt)}|status=queued|backend=local-microJS+free-agent-portal`;
}

// ============= 2TB SOVLINUX USB intake (E:\ SOVLINUX on Falcon USB) =============

export function to2TBSovlinuxIntake({ cascadeId, packetSha16, mountState = 'gated' }) {
  const intakePid = sha16(`sovlinux-2tb|${cascadeId}|${packetSha16}`);
  return `SOVLINUX-2TB-INTAKE|intake_pid=${intakePid}|cascade=${cascadeId}|packet=${packetSha16}|device=Falcon-USB-2TB|mount=E:|mount_state=${mountState}|operator_gate_required=true|signature_expected=2814414849`;
}

// ============= 128GB Liris USB (94GB unallocated waiting carve) =============

export function to128GBLirisIntake({ cascadeId, packetSha16, partitionTier }) {
  const intakePid = sha16(`liris-128gb|${cascadeId}|${packetSha16}|tier=${partitionTier}`);
  return `LIRIS-128GB-INTAKE|intake_pid=${intakePid}|cascade=${cascadeId}|packet=${packetSha16}|device=Liris-USB-128GB|partition_tier=${partitionTier}|unallocated_gb=94|carve_pending=operator_admin`;
}

// ============= 35TB Google Drive substrate (plasmatoid@gmail.com) =============

export function to35TBGoogleDriveSubstrate({ cascadeId, packetSha16, lane }) {
  const driveSlotPid = sha16(`google-drive-35tb|${cascadeId}|${packetSha16}|lane=${lane}`);
  return `GOOGLE-DRIVE-35TB|slot_pid=${driveSlotPid}|cascade=${cascadeId}|packet=${packetSha16}|lane=${lane}|account=plasmatoid@gmail.com|plan=AI-Ultra|total_TB=35|used_GB=104|free_TB=34.9|adc_gate=operator_gated`;
}

// ============= Router dispatch plan (omnidispatcher :4950 + 1000-slot fabric) =============

export function toRouterDispatchPlan({ cascadeId, waveIdx, packetCount, workerCount = 8 }) {
  const planPid = sha16(`router-dispatch|${cascadeId}|w${waveIdx}|n=${packetCount}|workers=${workerCount}`);
  const slotsNeeded = Math.min(1000, Math.ceil(packetCount / workerCount));
  return `ROUTER-DISPATCH-PLAN|plan_pid=${planPid}|cascade=${cascadeId}|wave=${waveIdx}|packets=${packetCount}|workers=${workerCount}|slots_required=${slotsNeeded}|omnidispatcher_url=http://127.0.0.1:4950|backpressure_threshold=900_slots_used`;
}

// ============= Full-system extended emit =============

export function emitFullExtendedRows({ cascadeId, waveIdx, stats, samplePacket }) {
  const rows = [];
  rows.push(toRouterDispatchPlan({ cascadeId, waveIdx, packetCount: stats.totalPackets }));
  rows.push(to35TBGoogleDriveSubstrate({ cascadeId, packetSha16: sha16(stats.totalPackets), lane: 'memory' }));
  rows.push(to128GBLirisIntake({ cascadeId, packetSha16: sha16(stats.totalGenius), partitionTier: 1 }));
  rows.push(to2TBSovlinuxIntake({ cascadeId, packetSha16: sha16(stats.totalMistake) }));
  if (samplePacket) {
    rows.push(toOmniscrcpyFrame({ cascadeId, beatIdx: samplePacket.beatIdx, deviceSerial: 'R5CXA4MGQXV' }));
    rows.push(toOmnicoderTask({ cascadeId, waveIdx, codePrompt: `wave-${waveIdx}-classify-packet-${samplePacket.pid.slice(0,16)}` }));
  }
  return rows;
}

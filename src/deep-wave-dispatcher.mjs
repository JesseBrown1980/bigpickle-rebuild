// Deep-Wave dispatcher orchestrator.
// Composes deep-wave-decompose + PIDChainRevolver (7-lane post-LYMPHATIC) + Hookwall + GNN ledger.
// Pure module; CLI/smoke fire wraps this in batched mode.
//
// Spec: acer-10K-ROOM-X-93312-BEAT-DEEP-WAVE-DISPATCHER-DESIGN-2026-05-28T17-05Z chain seq=3468
//
// "scale" arg gates how much of the 93312-beat grid x 10K-room fabric is actually fired.
// Full execution requires operator vote-quorum per LAW v3 vote-not-pass.

import { createHash } from 'node:crypto';
import { PIDChainRevolver, LANE_CYCLE } from './pid-chain-revolver.mjs';
import { Hookwall } from './hookwall.mjs';
import { createGNNEdgeLedger } from './gnn-edge-ledger.mjs';
import { decomposeBeat, roomId, roomActiveForBeat, WAVE_COUNT, BEATS_PER_WAVE, TOTAL_BEATS } from './deep-wave-decompose.mjs';

function pidScore(pid) {
  const h = createHash('sha256').update(String(pid)).digest();
  return h.readUInt32BE(0) / 0xFFFFFFFF;
}

// dispatchWave fires one wave of beats over given rooms.
// Returns aggregate stats. PURE w.r.t. its inputs (deterministic from anchor + range).
export function dispatchWave({
  waveIdx,
  beatStart,
  beatEnd,
  rooms,
  cascadeId,
  vantage = 'acer',
  geniusThreshold = 0.95,
  mistakeThreshold = 0.05,
  roomPolicy = 'all',
}) {
  if (!Number.isInteger(waveIdx) || waveIdx < 0 || waveIdx >= WAVE_COUNT) {
    throw new RangeError(`dispatchWave: waveIdx 0..${WAVE_COUNT - 1} (got ${waveIdx})`);
  }
  if (beatEnd > TOTAL_BEATS) throw new RangeError(`dispatchWave: beatEnd > ${TOTAL_BEATS}`);
  if (!Array.isArray(rooms) || rooms.length === 0) throw new TypeError('dispatchWave: rooms must be non-empty array');

  const ledger = createGNNEdgeLedger();
  const laneCounts = Object.fromEntries(LANE_CYCLE.map(l => [l, 0]));
  let totalPackets = 0;
  let totalGenius = 0;
  let totalMistake = 0;
  let totalNeutral = 0;
  let totalHookwallPass = 0;
  let totalHookwallReject = 0;
  let scoreSum = 0;

  const perRoomRevolvers = new Map();
  const perRoomHookwalls = new Map();
  for (const room of rooms) {
    const anchor = `DEEP-WAVE-${cascadeId}-WAVE-${waveIdx}-${room.id}`;
    perRoomRevolvers.set(room.idx, new PIDChainRevolver({ anchor }));
    perRoomHookwalls.set(room.idx, new Hookwall({ name: `dw-${cascadeId}-w${waveIdx}-${room.id}` }));
  }

  for (let beatIdx = beatStart; beatIdx < beatEnd; beatIdx++) {
    const decomposed = decomposeBeat(beatIdx);
    if (decomposed.wave !== waveIdx) continue; // safety: stay in wave

    for (const room of rooms) {
      if (!roomActiveForBeat({ roomIdx: room.idx, beatIdx, policy: roomPolicy, roomCount: rooms.length })) continue;

      const revolver = perRoomRevolvers.get(room.idx);
      const hookwall = perRoomHookwalls.get(room.idx);

      for (let laneIdx = 0; laneIdx < LANE_CYCLE.length; laneIdx++) {
        const pid = revolver.next();
        const score = pidScore(pid);
        const lane = LANE_CYCLE[laneIdx];
        laneCounts[lane]++;
        totalPackets++;

        const envelope = {
          type: 'deep-wave-packet',
          tupleTag: [score, beatIdx, room.idx],
          pid, lane, score,
          beatIdx, beatDecomposed: decomposed,
          roomId: room.id, roomIdx: room.idx,
          cascadeId, waveIdx,
        };
        try {
          hookwall.pass(envelope);
          totalHookwallPass++;
        } catch (e) {
          totalHookwallReject++;
          continue;
        }
        scoreSum += score;
        if (score > geniusThreshold) totalGenius++;
        else if (score < mistakeThreshold) totalMistake++;
        else totalNeutral++;

        if (totalPackets % 1000 === 0) {
          ledger.recordEdge?.({ from: pid, to: `lane:${lane}`, weight: score, kind: 'deep-wave' });
        }
      }
    }
  }

  return {
    waveIdx,
    cascadeId,
    vantage,
    beatRange: [beatStart, beatEnd],
    rooms_count: rooms.length,
    lanes_per_room: LANE_CYCLE.length,
    totalPackets,
    totalGenius,
    totalMistake,
    totalNeutral,
    totalHookwallPass,
    totalHookwallReject,
    laneCounts,
    avgScore: totalPackets > 0 ? scoreSum / totalPackets : 0,
  };
}

export function buildRoomList({ count, vantage = 'acer' }) {
  const rooms = [];
  for (let i = 0; i < count; i++) {
    rooms.push({ idx: i, id: roomId({ idx: i, vantage }) });
  }
  return rooms;
}

export function expectedPacketsForWave({ beatStart, beatEnd, roomCount, lanesPerRoom = LANE_CYCLE.length, roomPolicy = 'all' }) {
  const beatSpan = beatEnd - beatStart;
  if (roomPolicy === 'all') return beatSpan * roomCount * lanesPerRoom;
  if (roomPolicy === 'body-match-modulo-6' || roomPolicy === 'protocol-match-modulo-6') {
    return Math.ceil((beatSpan * roomCount * lanesPerRoom) / 6);
  }
  throw new RangeError(`expectedPacketsForWave: unknown policy ${roomPolicy}`);
}

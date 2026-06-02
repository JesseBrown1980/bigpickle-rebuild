// Integration tests for deep-wave-integrate.mjs adapters.
// Per operator 2026-05-28T17:09Z + 17:11Z:
//   "integration piping to HyperBEHCS / BEHCS-256 / 1024 / federation / cues / maps / 3D map / memory-AI / atlas / Asolaria super-dashboard agents tasks and lists"
//   "+ omnischeduler + omnimets + omnirouters + quant engines upgraded + no json + pid specific + glyphs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBEHCS256Glyph, toBEHCS1024Glyph,
  toHyperBEHCSTripleQuant,
  toAtlasVoxel, to3DMapPoint,
  toMemoryAICandidate,
  toSuperDashboardTile,
  toOmnischedulerTask, toOmnimetsSample, toOmnirouterDest,
  toQuantEnginesComposite,
  toFederationCue,
  emitFullIntegrationRows,
} from '../src/deep-wave-integrate.mjs';

const samplePid = '00112233445566778899aabbccddeeff';
const sampleStats = {
  totalPackets: 7000, totalGenius: 350, totalMistake: 350, totalNeutral: 6300,
  totalHookwallPass: 7000, totalHookwallReject: 0,
  beatRange: [0, 1000], rooms_count: 10, lanes_per_room: 7,
  avgScore: 0.5,
};

test('toBEHCS256Glyph emits pipe-row, NO JSON', () => {
  const row = toBEHCS256Glyph({ pid: samplePid });
  assert.match(row, /^BEHCS256-GLYPH\|/);
  assert.match(row, /\|alphabet=256/);
  assert.ok(!row.includes('{'), 'must not contain JSON braces');
});

test('toBEHCS256Glyph respects explicit actor', () => {
  const row = toBEHCS256Glyph({ pid: samplePid, actor: 42 });
  assert.match(row, /actor=42/);
  assert.match(row, /glyph=cp002a/);
});

test('toBEHCS1024Glyph emits subset_embed_256 flag', () => {
  const row255 = toBEHCS1024Glyph({ pid: samplePid, actor: 255 });
  assert.match(row255, /subset_embed_256=true/);
  const row256 = toBEHCS1024Glyph({ pid: samplePid, actor: 256 });
  assert.match(row256, /subset_embed_256=false/);
  assert.match(row256, /alphabet=1024/);
});

test('toHyperBEHCSTripleQuant emits 4-quant vector pipe-row', () => {
  const row = toHyperBEHCSTripleQuant({ pid: samplePid, score: 0.5, beatIdx: 100 });
  assert.match(row, /^HYPERBEHCS-TQ\|/);
  assert.match(row, /polar=/);
  assert.match(row, /turbo=/);
  assert.match(row, /JL=/);
  assert.match(row, /zeta=/);
  assert.ok(!row.includes('{'));
});

test('toAtlasVoxel emits voxel + hilbert pipe-row', () => {
  const row = toAtlasVoxel({ beatIdx: 100, roomIdx: 5, cascadeId: 'test-cascade' });
  assert.match(row, /^ATLAS-VOXEL\|/);
  assert.match(row, /x=\d+\|y=\d+\|z=\d+/);
  assert.match(row, /hilbert=[a-f0-9]{12}/);
});

test('to3DMapPoint emits coord with dim label', () => {
  const row = to3DMapPoint({ beatIdx: 0, roomIdx: 0 });
  assert.match(row, /^MAP-3D\|/);
  assert.match(row, /coord=0,0,0/);
  assert.match(row, /scout\/bus\/dashboard\/G\/operator/);
});

test('toMemoryAICandidate emits canon-index format', () => {
  const row = toMemoryAICandidate({ cascadeId: 'tc', stats: sampleStats });
  assert.match(row, /^MEMORY-AI-CANDIDATE\|/);
  assert.match(row, /class=Project/);
  assert.match(row, /total_packets=7000/);
  assert.match(row, /lanes=7/); // post-LYMPHATIC
});

test('toSuperDashboardTile emits HBPv1 pipe-row not JSON', () => {
  const row = toSuperDashboardTile({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats });
  assert.match(row, /^DASHBOARD-TILE\|/);
  assert.match(row, /wave_name=scout/);
  assert.match(row, /packets=7000/);
  assert.ok(!row.includes('{'), 'no JSON');
});

test('toOmnischedulerTask generates deterministic task PID', () => {
  const row1 = toOmnischedulerTask({ cascadeId: 'a', waveIdx: 0, beatStart: 0, beatEnd: 100, roomCount: 10 });
  const row2 = toOmnischedulerTask({ cascadeId: 'a', waveIdx: 0, beatStart: 0, beatEnd: 100, roomCount: 10 });
  assert.equal(row1, row2, 'same inputs must yield same task PID');
  assert.match(row1, /^OMNISCHEDULER-TASK\|task_pid=[a-f0-9]{16}\|/);
});

test('toOmnimetsSample emits multiple metrics per sample PID', () => {
  const row = toOmnimetsSample({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats });
  assert.match(row, /^OMNIMETS-SAMPLE\|sample_pid=[a-f0-9]{16}/);
  assert.match(row, /metric=packets_per_wave\|value=7000/);
  assert.match(row, /metric=genius_rate/);
  assert.match(row, /metric=mistake_rate/);
  assert.match(row, /metric=avg_score/);
});

test('toOmnirouterDest emits route PID + dest from lane + body', () => {
  const packet = { pid: samplePid, lane: 'lymphatic', beatDecomposed: { body: 5 } };
  const row = toOmnirouterDest({ cascadeId: 'tc', waveIdx: 0, packet });
  assert.match(row, /^OMNIROUTER-DEST\|route_pid=[a-f0-9]{16}/);
  assert.match(row, /dest=lane:lymphatic\|body:prof/);
});

test('toQuantEnginesComposite emits 4 quants + L2 norm', () => {
  const row = toQuantEnginesComposite({ pid: samplePid, score: 0.5, beatIdx: 100 });
  assert.match(row, /^QUANT-COMPOSITE\|pid=[a-f0-9]{16}/);
  assert.match(row, /polar=/);
  assert.match(row, /turbo=/);
  assert.match(row, /JL=/);
  assert.match(row, /zeta=/);
  assert.match(row, /L2_norm=/);
  assert.match(row, /engines=polar\+turbo\+JL\+zeta/);
});

test('toFederationCue includes all 9 federation device targets', () => {
  const row = toFederationCue({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats });
  assert.match(row, /^FEDERATION-CUE\|cue_pid=[a-f0-9]{16}/);
  for (const dev of ['acer', 'liris', 'falcon', 'felipe', 'beast', 'gpt', 'google-antigravity', 'symphony', 'auggie']) {
    assert.ok(row.includes(dev), `federation cue must include ${dev}`);
  }
});

test('emitFullIntegrationRows produces 5+ rows without samplePacket', () => {
  const rows = emitFullIntegrationRows({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats });
  assert.ok(rows.length >= 5);
  for (const r of rows) {
    assert.ok(!r.includes('{'), `row contains JSON braces: ${r}`);
    assert.match(r, /^[A-Z][A-Z0-9-]*\|/);
  }
});

test('emitFullIntegrationRows produces 12 rows with samplePacket (per-packet integrations)', () => {
  const samplePacket = {
    pid: samplePid,
    score: 0.5,
    lane: 'lymphatic',
    beatIdx: 100,
    roomIdx: 5,
    beatDecomposed: { body: 5 },
  };
  const rows = emitFullIntegrationRows({ cascadeId: 'tc', waveIdx: 0, stats: sampleStats, samplePacket });
  assert.equal(rows.length, 12);
  // verify all 7 per-packet integration rows present
  const tags = rows.map(r => r.split('|')[0]);
  assert.ok(tags.includes('BEHCS256-GLYPH'));
  assert.ok(tags.includes('BEHCS1024-GLYPH'));
  assert.ok(tags.includes('HYPERBEHCS-TQ'));
  assert.ok(tags.includes('ATLAS-VOXEL'));
  assert.ok(tags.includes('MAP-3D'));
  assert.ok(tags.includes('OMNIROUTER-DEST'));
  assert.ok(tags.includes('QUANT-COMPOSITE'));
  assert.ok(tags.includes('OMNISCHEDULER-TASK'));
  assert.ok(tags.includes('OMNIMETS-SAMPLE'));
  assert.ok(tags.includes('FEDERATION-CUE'));
  assert.ok(tags.includes('MEMORY-AI-CANDIDATE'));
  assert.ok(tags.includes('DASHBOARD-TILE'));
});

test('all integration rows are HBPv1 pipe-row format (no JSON anywhere)', () => {
  const samplePacket = { pid: samplePid, score: 0.5, lane: 'memory', beatIdx: 50, roomIdx: 3, beatDecomposed: { body: 2 } };
  const rows = emitFullIntegrationRows({ cascadeId: 'all-pipe-row-test', waveIdx: 0, stats: sampleStats, samplePacket });
  const all = rows.join('\n');
  assert.ok(!all.includes('{'), 'NO JSON braces anywhere');
  assert.ok(!all.includes('}'), 'NO JSON braces anywhere');
  assert.ok(!all.includes('"'), 'NO JSON quotes anywhere');
});

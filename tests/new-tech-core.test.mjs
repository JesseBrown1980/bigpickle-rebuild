// Unit tests for new-tech-core subsystems.
// Per operator 2026-05-28T20:56Z "tests and integration and unit tests".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sha16, pipeRow,
  glyphMint,
  whiteRoomMint, WHITE_ROOM_GATES,
  shannonEntropy,
  gcSweepClassifier, gcManifestRow,
  autoTranslate, SUPPORTED_LANGS,
  to3DMapPoint,
  atlasV57Voxel, ATLAS_V57_LAYERS,
  runFullPipeline,
} from '../src/new-tech-core.mjs';

const sampleFinding = { class: 'genius-supervisor', source: '1e200-sweep', name: 'GS-1E200-00' };
const mkFinding = { class: 'mk-supervisor', source: 'mk-cascade', name: 'SUP-MK-SCOUT', hilbert: 830 };

// =================== GLYPH MINT ===================
test('glyphMint produces deterministic PID for same input', () => {
  const a = glyphMint(sampleFinding);
  const b = glyphMint(sampleFinding);
  assert.equal(a.pid, b.pid);
  assert.equal(a.BEHCS256, b.BEHCS256);
});

test('glyphMint different findings yield different PIDs', () => {
  const a = glyphMint(sampleFinding);
  const b = glyphMint({ ...sampleFinding, name: 'GS-1E200-01' });
  assert.notEqual(a.pid, b.pid);
});

test('glyphMint actor256 in [0, 256) and actor1024 in [0, 1024)', () => {
  for (let i = 0; i < 20; i++) {
    const g = glyphMint({ class: 'test', source: 'unit', name: `T-${i}` });
    assert.ok(g.actor256 >= 0 && g.actor256 < 256);
    assert.ok(g.actor1024 >= 0 && g.actor1024 < 1024);
    assert.match(g.BEHCS256, /^cp[0-9a-f]{4}$/);
    assert.match(g.BEHCS1024, /^cp[0-9a-f]{4}$/);
  }
});

test('glyphMint row format is HBPv1 pipe-row (no JSON)', () => {
  const g = glyphMint(sampleFinding);
  assert.match(g.row, /^GLYPH\|/);
  assert.ok(!g.row.includes('{'));
  assert.ok(!g.row.includes('"'));
});

// =================== WHITE ROOM ===================
test('whiteRoomMint produces deterministic PID + valid ingress glyph', () => {
  const wr = whiteRoomMint(sampleFinding);
  assert.match(wr.pid, /^[a-f0-9]{16}$/);
  assert.match(wr.ingressGlyph, /^cp[0-9a-f]{4}$/);
  assert.deepEqual(wr.gates, WHITE_ROOM_GATES);
});

test('whiteRoomMint contains all 7 canonical gates', () => {
  assert.equal(WHITE_ROOM_GATES.length, 7);
  for (const gate of ['GC', 'super-gulp', 'reverse-gain-GNN', 'omnishannon', 'omnihermes', 'omniGNN', 'crop-paper']) {
    assert.ok(WHITE_ROOM_GATES.includes(gate), `missing gate: ${gate}`);
  }
});

test('whiteRoomMint row is HBPv1 pipe-row', () => {
  const wr = whiteRoomMint(sampleFinding);
  assert.match(wr.row, /^WHITE-ROOM\|/);
  assert.match(wr.row, /clean_room_origin=true/);
  assert.ok(!wr.row.includes('{'));
});

// =================== SHANNON ENTROPY ===================
test('shannonEntropy perfect uniform 7-lane gives efficiency=1.0', () => {
  const uniform = [142857, 142857, 142857, 142857, 142857, 142857, 142857];
  const s = shannonEntropy(uniform);
  assert.equal(s.efficiency.toFixed(6), '1.000000');
  assert.equal(s.H.toFixed(4), Math.log2(7).toFixed(4));
});

test('shannonEntropy single-lane saturation gives efficiency=0', () => {
  const skewed = [1000, 0, 0, 0, 0, 0, 0];
  const s = shannonEntropy(skewed);
  assert.equal(s.efficiency, 0);
  assert.equal(s.H, 0);
});

test('shannonEntropy 50/50 binary gives H=1 bit', () => {
  const binary = [500, 500];
  const s = shannonEntropy(binary);
  assert.equal(s.H, 1);
  assert.equal(s.maxH, 1);
  assert.equal(s.efficiency, 1);
});

test('shannonEntropy handles all-zero gracefully', () => {
  const empty = [0, 0, 0, 0, 0, 0, 0];
  const s = shannonEntropy(empty);
  assert.equal(s.H, 0);
  assert.equal(s.efficiency, 0);
});

// =================== GC ===================
test('gcSweepClassifier accepts hbp+hbi+hex+sha256+ing', () => {
  assert.equal(gcSweepClassifier('foo.hbp'), true);
  assert.equal(gcSweepClassifier('foo.hbi'), true);
  assert.equal(gcSweepClassifier('foo.hex'), true);
  assert.equal(gcSweepClassifier('foo.sha256'), true);
  assert.equal(gcSweepClassifier('foo.ing'), true);
});

test('gcSweepClassifier rejects non-quintet files', () => {
  assert.equal(gcSweepClassifier('foo.txt'), false);
  assert.equal(gcSweepClassifier('foo.json'), false);
  assert.equal(gcSweepClassifier('foo.mjs'), false);
});

test('gcManifestRow includes NEVER_DELETE policy', () => {
  const row = gcManifestRow({ totalFiles: 100, totalBytes: 1024, pathsScanned: 3 });
  assert.match(row, /action=INVENTORY_ONLY/);
  assert.match(row, /deletions=0/);
  assert.match(row, /policy=NEVER_DELETE/);
  assert.match(row, /total_files=100/);
  assert.match(row, /total_MB=0.00/);
});

// =================== AUTO-TRANSLATE ===================
test('autoTranslate sha16-to-BEHCS-256 returns valid glyph', () => {
  const pid = sha16('test');
  const out = autoTranslate(pid, 'sha16-hash', 'BEHCS-256');
  assert.match(out, /^cp[0-9a-f]{4}$/);
});

test('autoTranslate identity (any-to-sha16-hash) returns original pid', () => {
  const pid = sha16('identity-test');
  for (const fromL of SUPPORTED_LANGS) {
    const out = autoTranslate(pid, fromL, 'sha16-hash');
    assert.equal(out, pid);
  }
});

test('autoTranslate BEHCS-1024 with actor>=256 cannot downcast to BEHCS-256', () => {
  // Find a PID whose actor1024 >= 256
  let found = false;
  for (let i = 0; i < 1000; i++) {
    const pid = sha16(`actor-search-${i}`);
    const actor1024 = parseInt(pid.slice(0, 4), 16) % 1024;
    if (actor1024 >= 256) {
      assert.throws(() => autoTranslate(pid, 'BEHCS-1024', 'BEHCS-256'), RangeError);
      found = true;
      break;
    }
  }
  assert.ok(found, 'expected to find actor1024 >= 256 within search');
});

test('autoTranslate rejects unknown lang', () => {
  const pid = sha16('test');
  assert.throws(() => autoTranslate(pid, 'unknown-lang', 'sha16-hash'), RangeError);
  assert.throws(() => autoTranslate(pid, 'sha16-hash', 'unknown-lang'), RangeError);
});

test('autoTranslate glyph_5-apex format includes star prefix', () => {
  const pid = sha16('apex-test');
  const out = autoTranslate(pid, 'sha16-hash', 'glyph_5-apex');
  assert.ok(out.startsWith('★'), `expected star prefix, got ${out}`);
});

// =================== 3D MAP ===================
test('to3DMapPoint produces coords in [0, 1024)', () => {
  for (let i = 0; i < 50; i++) {
    const p = to3DMapPoint(`test-${i}`);
    assert.ok(p.x >= 0 && p.x < 1024);
    assert.ok(p.y >= 0 && p.y < 1024);
    assert.ok(p.z >= 0 && p.z < 1024);
    assert.match(p.pid, /^[a-f0-9]{16}$/);
  }
});

test('to3DMapPoint deterministic for same name', () => {
  const a = to3DMapPoint('GS-1E200-00');
  const b = to3DMapPoint('GS-1E200-00');
  assert.deepEqual(a, b);
});

// =================== ATLAS V57 VOXEL ===================
test('atlasV57Voxel produces correct voxelId format', () => {
  const v = atlasV57Voxel(sampleFinding, 7);
  assert.equal(v.voxelId, 'V57-newtech-007');
});

test('atlasV57Voxel includes hilbert from finding when present', () => {
  const v = atlasV57Voxel(mkFinding, 0);
  assert.equal(v.hilbert, 830);
});

test('atlasV57Voxel status is DESIGN_MINTED_PENDING_APEX_MINT', () => {
  const v = atlasV57Voxel(sampleFinding, 0);
  assert.match(v.status, /DESIGN_MINTED_PENDING_APEX_MINT/);
  assert.match(v.status, /quintuple_seq_3471/);
});

test('ATLAS_V57_LAYERS exactly 4 new layers', () => {
  assert.equal(ATLAS_V57_LAYERS.length, 4);
  assert.deepEqual(ATLAS_V57_LAYERS, ['L24_glyph_minted', 'L25_white_rooms', 'L26_shannon', 'L27_auto_translate']);
});

// Unit tests for district-fabric.mjs — PID minting, district creation, HBP descriptors (no JSON).
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// point substrate at a temp dir BEFORE importing
const tmp = mkdtempSync(join(tmpdir(), 'district-'));
process.env.ASOLARIA_DISTRICT_ROOT = tmp;

const {
  sha16, hilbertXY, roomPid, DISTRICTS,
  createDistrict, createAllDistricts, roomDir, SUBSTRATE_ROOT,
} = await import('../../src/district-fabric.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');

test('Brown-Hilbert XY is deterministic + non-colliding for adjacent idx', () => {
  const a = hilbertXY(128, 100);
  const b = hilbertXY(128, 100);
  assert.deepEqual(a, b, 'same idx => same coord (deterministic)');
  const c = hilbertXY(128, 101);
  assert.ok(a.x !== c.x || a.y !== c.y, 'adjacent idx => different coord (no collision)');
});

test('roomPid is deterministic, district-tagged, unique per idx', () => {
  const p1 = roomPid('rotator', 5);
  const p2 = roomPid('rotator', 5);
  const p3 = roomPid('rotator', 6);
  assert.equal(p1, p2, 'deterministic');
  assert.notEqual(p1, p3, 'unique per idx');
  assert.ok(p1.startsWith('BH.DISTRICT.ROTATOR.R00005.'), 'district + idx tagged');
});

test('DISTRICTS catalog has the 6 expected families with cp bands', () => {
  const names = DISTRICTS.map((d) => d.name);
  assert.deepEqual(names, ['rotator', 'prism', 'engineering', 'white-room', 'gnn-feed', 'council']);
  for (const d of DISTRICTS) {
    assert.ok(typeof d.cp === 'number', `${d.name} has cp band`);
    assert.ok(d.rooms > 0, `${d.name} has room count`);
  }
});

test('createDistrict (dry-run) reports room count without writing rooms', () => {
  const r = createDistrict({ name: 'test-rotator', kind: 'pid-rotation', role: 'test', rooms: 50, cp: 480 }, { dryRun: true });
  assert.equal(r.rooms, 50);
  assert.ok(r.supervisor_pid.startsWith('BH.SUPERVISOR.DISTRICT.TEST-ROTATOR.'));
});

test('createDistrict (real, small) writes ROOM.hbp + inbox + outbox + supervisor, all HBP no JSON', () => {
  const r = createDistrict({ name: 'mini', kind: 'build', role: 'mini test district', rooms: 3, cp: 704 }, {});
  assert.equal(r.rooms, 3);

  // supervisor file exists + is HBP + pid_specific
  const supPath = join(SUBSTRATE_ROOT, 'mini', '_SUPERVISOR.hbp');
  assert.ok(existsSync(supPath));
  const sup = parsePipeRow(readFileSync(supPath, 'utf8').trim());
  assert.equal(sup.fields.pid_specific, 'true');
  assert.equal(sup.fields.json, '0');
  assert.ok(sup.fields.knows_formats.includes('quad-quant'));

  // room 0 descriptor is valid HBP with a Brown-Hilbert PID
  const rd = roomDir('mini', 0);
  const desc = parsePipeRow(readFileSync(join(rd, 'ROOM.hbp'), 'utf8').trim());
  assert.equal(desc.tag, 'HBPv1');
  assert.equal(desc.fields.district, 'mini');
  assert.equal(desc.fields.state, 'empty');
  assert.ok(desc.fields.pid.startsWith('BH.DISTRICT.MINI.R00000.'));
  assert.equal(desc.fields.json, '0');

  // inbox/outbox are LAZY now — created on first use by the dispatcher, not at room creation
  assert.ok(existsSync(join(rd, 'ROOM.hbp')), 'descriptor exists');
  assert.ok(!existsSync(join(rd, 'inbox.hbp')), 'inbox lazy (created on first use)');
  // 60D+ friendly: descriptor carries coord64 + glyph (language) + cube tuple
  assert.equal(desc.fields.dims, '64', '60D+ coordinate present');
  assert.ok(desc.fields.coord64 && desc.fields.coord64.length === 64, '64-dim coord');
  assert.ok(desc.fields.glyph && desc.fields.glyph.startsWith('cp'), 'BEHCS-1024 glyph (language)');
  assert.ok(desc.fields.tuple && desc.fields.tuple.includes('wave='), 'cube tuple present');
});

test('createAllDistricts (dry-run) totals all 6 districts + writes no FABRIC.hbp', () => {
  const r = createAllDistricts({ dryRun: true });
  assert.equal(r.districts.length, 6);
  const expected = DISTRICTS.reduce((a, d) => a + d.rooms, 0);
  assert.equal(r.total_rooms, expected, 'total = sum of district room counts (10,000)');
  assert.equal(existsSync(join(SUBSTRATE_ROOT, 'FABRIC.hbp')), false, 'dry-run writes nothing');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

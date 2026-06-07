// UNIT — stage2-cleanser: the explicit project-name cleanse + re-point logic.
// Proves: canonical derivation is deterministic, throwaway names are detected and
// cleansed, the work + flags survive, the chain is tamper-evident, output is pure HBP.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  canonicalProject, isThrowaway, collectionRoomFor,
  cleanseRecord, cleanseStream, verifyCleanseChain,
} from '../../src/stage2-cleanser.mjs';

const rec = (over = {}) => ({
  pid: 'BH.DISTRICT.ENGINEERING.R00007.ABCD',
  district: 'engineering', room: 7,
  project: 'C:/Asolaria-Districts/_keystone/fire-r000007-d0bc9149', // throwaway
  answer: 'Genius: rotate projects to stay free. Mistake: reuse one project name.',
  mark: 'genius', score: '0.88', verdict: 'FARM_GEM', gnn_lane: 'reverse_gain_gnn',
  ts: '2026-06-01T00:00:00.000Z',
  ...over,
});

test('canonicalProject is deterministic + stable regardless of throwaway folder', () => {
  const a = canonicalProject(rec());
  const b = canonicalProject(rec({ project: 'C:/somewhere/else/omni-room-behcs-256-9999' }));
  assert.equal(a, b, 'same district+room => same canonical project (folder name irrelevant)');
  assert.ok(a.startsWith('asolaria/engineering/'), 'correctly-pointed namespace');
  assert.ok(a.endsWith('r000007'), 'points at the stable room identity');
});

test('isThrowaway detects rotated names; canonical form is NOT throwaway', () => {
  assert.equal(isThrowaway('C:/Asolaria-Districts/_keystone/fire-r000007-d0bc9149'), true);
  assert.equal(isThrowaway('omni-room-behcs-256-4821'), true);
  assert.equal(isThrowaway('asolaria/engineering/cp01a4/r000007'), false, 'already-canonical is clean');
});

test('cleanseRecord: throwaway -> cleansed=true, was_project kept, canonical pointed, work preserved', () => {
  const c = cleanseRecord(rec(), { ts: '2026-06-01T00:00:01.000Z' });
  assert.equal(c.cleansed, true, 'throwaway folder was cleansed');
  assert.equal(c.fields.was_project, 'C:/Asolaria-Districts/_keystone/fire-r000007-d0bc9149', 'audit: what was cleansed');
  assert.ok(c.canonical_project.startsWith('asolaria/engineering/'), 're-pointed to canonical');
  assert.equal(c.fields.verdict, 'FARM_GEM', 'routing flag preserved');
  assert.equal(c.fields.gnn_lane, 'reverse_gain_gnn', 'gnn lane preserved');
  assert.equal(c.fields.answer_sha256.length, 64, 'answer sha computed/preserved');
  assert.ok(typeof c.collection_room === 'number' && c.collection_room >= 0, 'collection room assigned');
});

test('cleanseRecord is idempotent — an already-canonical project is not re-cleansed', () => {
  const c = cleanseRecord(rec({ project: 'asolaria/engineering/cp01a4/r000007' }), {});
  assert.equal(c.cleansed, false, 'clean pointer stays clean (no double-cleanse)');
});

test('collection room is deterministic + in-bounds; same canonical => same room (groups together)', () => {
  const canon = canonicalProject(rec());
  const r1 = collectionRoomFor(canon, 1);
  const r2 = collectionRoomFor(canon, 1);
  assert.equal(r1.roomId, r2.roomId, 'deterministic');
  assert.ok(r1.roomId >= 0 && r1.roomId < r1.count, 'in bounds');
});

test('cleanseStream chains prev_hash tamper-evidently (root = zeros, each links to prev)', () => {
  const s = cleanseStream([rec(), rec({ room: 8, answer: 'second' }), rec({ room: 9, answer: 'third' })], { ts: 'T', scale: 1 });
  assert.equal(s.count, 3);
  assert.equal(s.rows[0].fields.prev_hash, '0'.repeat(64), 'root');
  assert.equal(s.rows[1].fields.prev_hash, s.rows[0].row_hash, 'link 0->1');
  assert.equal(s.rows[2].fields.prev_hash, s.rows[1].row_hash, 'link 1->2');
  assert.notEqual(s.rows[0].fields.cleanse_pid, s.rows[1].fields.cleanse_pid, 'unique cleanse PID per record (revolver)');
});

test('verifyCleanseChain validates a good chain and DETECTS tamper', () => {
  const s = cleanseStream([rec(), rec({ room: 8, answer: 'second' })], { ts: 'T', scale: 1 });
  const good = verifyCleanseChain(s.rows);
  assert.equal(good.ok, true, 'untampered chain verifies');
  assert.equal(good.cleansed_count, 2, 'both were cleansed');
  // tamper the canonical pointer without re-hashing => caught
  const tampered = s.rows.map((r) => ({ ...r, fields: { ...r.fields } }));
  tampered[0].fields.canonical_project = 'asolaria/evil/forged';
  assert.equal(verifyCleanseChain(tampered).ok, false, 'forged canonical pointer caught');
  // break the prev_hash link => caught
  const broken = s.rows.map((r) => ({ ...r, fields: { ...r.fields } }));
  broken[1].fields.prev_hash = 'f'.repeat(64);
  assert.equal(verifyCleanseChain(broken).ok, false, 'broken chain link caught');
});

test('output is pure HBP — json=0 marker, no JSON braces in the row', () => {
  const c = cleanseRecord(rec(), {});
  assert.ok(c.row.startsWith('HBPv1|row=stage2_cleansed|'), 'HBPv1 pipe row');
  assert.ok(c.row.includes('|json=0|'), 'json=0 marker present');
  assert.ok(!c.row.includes('{') && !c.row.includes('}'), 'no JSON object in the hot path');
});

// INTEGRATION — stage-2 cleanse + collect across REAL built districts.
// Writes stage-1 outbox records (with throwaway project names) into engineering
// rooms, runs the sweep, and proves: cleansed rows land in the canonical prism
// collection rooms, names are cleansed (was_project kept, canonical pointed),
// a project's work groups into ONE collection room, the chain verifies, and
// pumpToRoom injects system data bidirectionally. Mock, free, fast.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'stage2-'));
process.env.ASOLARIA_DISTRICT_ROOT = tmp;

const { createDistrict, roomDir } = await import('../../src/district-fabric.mjs');
const { cleanseWorkRooms, verifyCleanseChain, canonicalProject, collectionRoomFor, pumpToRoom } =
  await import('../../src/stage2-cleanser.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');

// build stage-1 (engineering) + stage-2 (prism) districts
createDistrict({ name: 'engineering', kind: 'build', role: 'stage1', rooms: 20, cp: 704 }, { scale: 1 });
createDistrict({ name: 'prism', kind: 'dispatch-collect', role: 'stage2', rooms: 20, cp: 576 }, { scale: 1 });

// seed stage-1 outboxes with throwaway-project answers (what a fired agent leaves)
function seedRoom(roomId, answer, mark) {
  const rd = roomDir('engineering', roomId);
  mkdirSync(rd, { recursive: true });
  const row = `HBPv1|row=agent_answer|pid=BH.DISTRICT.ENGINEERING.R${String(roomId).padStart(5, '0')}.SEED` +
    `|project=C:/Asolaria-Districts/_keystone/fire-r${String(roomId).padStart(6, '0')}-${roomId}abcd` +
    `|answer=${answer}|mark=${mark}|score=0.8${roomId % 10}|verdict=FARM_GEM|gnn_lane=reverse_gain_gnn|ts=2026-06-01T00:00:00.000Z|json=0`;
  writeFileSync(join(rd, 'outbox.hbp'), row + '\n', 'utf8');
}

test('sweep cleanses stage-1 throwaway names and collects into canonical prism rooms', () => {
  for (let i = 0; i < 6; i++) seedRoom(i, `answer number ${i} from a real free agent`, i % 2 ? 'mistake' : 'genius');

  const swept = cleanseWorkRooms({ district: 'engineering', roomCount: 20, scale: 1, route: true });
  assert.equal(swept.count, 6, 'all 6 stage-1 records cleansed');

  // every row was cleansed (throwaway -> canonical) and chain is tamper-evident
  assert.equal(verifyCleanseChain(swept.rows).ok, true, 'cleanse chain verifies');
  assert.equal(verifyCleanseChain(swept.rows).cleansed_count, 6, 'all 6 were throwaway -> cleansed');

  for (const r of swept.rows) {
    assert.ok(r.canonical_project.startsWith('asolaria/engineering/'), 're-pointed to canonical');
    assert.ok(r.fields.was_project.includes('_keystone/fire-'), 'throwaway name recorded for audit');
  }
});

test('cleansed rows physically land in the correct prism collection room inbox', () => {
  // record for engineering room 0
  const canon = canonicalProject({ district: 'engineering', room: 0 });
  const { roomId } = collectionRoomFor(canon, 1);
  const inbox = join(roomDir('prism', roomId), 'inbox.hbp');
  assert.ok(existsSync(inbox), `prism collection room ${roomId} inbox written`);
  const rows = readFileSync(inbox, 'utf8').trim().split('\n').map((l) => parsePipeRow(l).fields);
  const mine = rows.find((f) => f.canonical_project === canon);
  assert.ok(mine, 'engineering room-0 work collected into its canonical prism room');
  assert.equal(mine.row, 'stage2_cleansed', 'it is a cleansed record (row type field)');
  assert.equal(mine.collection_room, String(roomId), 'collection_room field matches physical room');
});

test('pumpToRoom injects system data INTO any room (bidirectional / vice-versa)', () => {
  const res = pumpToRoom('gnn-feed', 3, 'system push: re-score this edge cluster', { source: 'omnidispatcher' });
  // gnn-feed wasn't pre-built; pump creates the room dir lazily
  assert.equal(res.pumped, true);
  assert.ok(existsSync(res.inbox), 'pumped row landed in the target room inbox');
  const f = parsePipeRow(readFileSync(res.inbox, 'utf8').trim()).fields;
  assert.equal(f.row, 'system_pump', 'row type is a system pump');
  assert.equal(f.source, 'omnidispatcher', 'system source recorded');
  assert.equal(f.district, 'gnn-feed');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

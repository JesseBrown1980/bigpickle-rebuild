// INTEGRATION — fabric-sector-cycle: the converged acer legs (LEG-2 prime-sector +
// LEG-3 github-bus) operating as ONE cycle. Proves address→score→genius-emits-to-bus,
// never-drop, sector-dimension matters, pure HBP. Bus half uses a local temp git repo.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSectorCycle, cycleRow } from '../../src/fabric-sector-cycle.mjs';
import { readBus } from '../../src/github-commit-emitter.mjs';

test('a sector cycle addresses + scores + never-drops (genius+mistake=rooms)', () => {
  const r = runSectorCycle({ sectorIndex: 0, rooms: 1000 });
  assert.equal(r.genius + r.mistake, 1000, 'never-drop: every room verdicted');
  assert.equal(r.prime, 2, 'sector 0 = prime 2');
  assert.equal(r.chief, 'CHIEF-ROBIN-BIOLOGY-SECTOR');
  assert.ok(r.genius > 0 && r.mistake > 0, 'score discriminates');
  assert.equal(r.geniusEnvelopes.length, r.genius);
});

test('deterministic + sector dimension MATTERS (different sectors => different genius set)', () => {
  const a = runSectorCycle({ sectorIndex: 0, rooms: 500 });
  const b = runSectorCycle({ sectorIndex: 0, rooms: 500 });
  assert.equal(a.genius, b.genius, 'deterministic');
  const c = runSectorCycle({ sectorIndex: 5, rooms: 500 });
  // same room indices, different sector => different addresses => (almost surely) different genius count
  assert.notDeepEqual(a.geniusEnvelopes, c.geniusEnvelopes, 'sector index changes the addresses');
  assert.equal(c.prime, 13, 'sector 5 = prime 13');
});

test('genius marks EMIT to the github-bus (commit=emit) — legs LEG-2+LEG-3 composed', () => {
  const repo = mkdtempSync(join(tmpdir(), 'fabcyc-'));
  const git = (a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', windowsHide: true });
  git(['init', '-q']); git(['config', 'user.email', 'f@a.local']); git(['config', 'user.name', 'fab']);
  git(['commit', '--allow-empty', '-m', 'root', '--no-verify']);
  const r = runSectorCycle({ sectorIndex: 2, rooms: 60, repoDir: repo });
  assert.equal(r.emitted, r.genius, 'every genius mark committed to the bus');
  const bus = readBus(repo, { prefix: 'sector' });
  assert.equal(bus.length, r.genius, 'bus log holds exactly the genius marks');
  assert.ok(bus.every((m) => m.message.startsWith('bus-emit|')), 'all are bus-emit commits');
  rmSync(repo, { recursive: true, force: true });
});

test('cycleRow is pure HBP (json=0, never_dropped flag, no braces)', () => {
  const row = cycleRow(runSectorCycle({ sectorIndex: 7, rooms: 100 }));
  assert.ok(row.startsWith('HBPv1|row=sector_cycle|sector=7|prime=19|'), 'sector 7 = primeAt(7) = 19');
  assert.ok(row.includes('|never_dropped=true|') && row.includes('|json=0'));
  assert.ok(!row.includes('{') && !row.includes('}'));
});

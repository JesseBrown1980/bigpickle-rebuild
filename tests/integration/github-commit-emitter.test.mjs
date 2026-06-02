// INTEGRATION — github-commit-emitter (LEG-3, GitHub-as-bus). Proves commit=emit,
// log=read, deterministic addressing, and the OUTWARD push double-gate — all in a
// LOCAL temp git repo (no network, no remote, no publish). HBP only.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitEnvelope, readBus, pushBus, busPath, sha8 } from '../../src/github-commit-emitter.mjs';

const repo = mkdtempSync(join(tmpdir(), 'ghbus-'));
function git(args) { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true }); }
// init a local repo (no remote)
git(['init', '-q']);
git(['config', 'user.email', 'bus@asolaria.local']);
git(['config', 'user.name', 'asolaria-bus']);
git(['commit', '--allow-empty', '-m', 'root', '--no-verify']);

const env = (i) => `HBPv1|row=bus_msg|seq=${i}|payload=room-${i}-work|mark=${i % 2 ? 'genius' : 'mistake'}|json=0`;

test('commit=EMIT — 5 envelopes become 5 deterministic-path commits', () => {
  const receipts = [];
  for (let i = 0; i < 5; i++) {
    const r = commitEnvelope(repo, { roomPid: `BH.ROOM.R${i}`, seq: i, envelope: env(i) });
    assert.equal(r.emitted, true);
    assert.equal(r.path, busPath(`BH.ROOM.R${i}`, i), 'deterministic bus path');
    assert.ok(existsSync(join(repo, r.path)), 'envelope file committed to working tree');
    assert.ok(r.message.includes(`sha8=${sha8(env(i) + '\n')}`), 'commit msg carries the content sha8');
    receipts.push(r);
  }
  // distinct commit hashes
  assert.equal(new Set(receipts.map((r) => r.commit)).size, 5, '5 distinct commits');
});

test('git log = READ — pull the bus by reading committed envelopes', () => {
  const bus = readBus(repo);
  assert.equal(bus.length, 5, '5 emitted messages readable from the log');
  assert.ok(bus.every((m) => m.message.startsWith('bus-emit|')), 'all are bus-emit commits');
  // the actual HBP content round-trips
  const newest = readFileSync(join(repo, busPath('BH.ROOM.R4', 4)), 'utf8').trim();
  assert.equal(newest, env(4), 'committed HBP envelope reads back byte-identical');
});

test('PUSH is DOUBLE-GATED — never publishes without {push, confirmed}', () => {
  assert.equal(pushBus(repo, {}).pushed, false, 'no opts -> gated');
  assert.equal(pushBus(repo, { push: true }).pushed, false, 'push alone -> gated');
  assert.equal(pushBus(repo, { confirmed: true }).pushed, false, 'confirmed alone -> gated');
  const g = pushBus(repo, {});
  assert.equal(g.gated, true);
  assert.ok(g.reason.includes('OUTWARD-FACING'), 'honest: publish is outward-facing + operator-gated');
});

test('bus addressing is pure HBP (no JSON envelopes on the wire)', () => {
  const r = commitEnvelope(repo, { roomPid: 'BH.ROOM.RX', seq: 99, envelope: env(99) });
  const content = readFileSync(join(repo, r.path), 'utf8');
  assert.ok(content.includes('|json=0'));
  assert.ok(!content.includes('{') && !content.includes('}'), 'no JSON in the committed envelope');
});

test.after(() => { try { rmSync(repo, { recursive: true, force: true }); } catch {} });

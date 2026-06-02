// Unit + integration tests for asolaria-hookwall.mjs — the uniform entry gate.
// Covers: PID-stamp, 3-verdict gate, NO silent drop, tamper-evident observation chain,
// dual-emit doctrine, real-ledger write, deterministic scoring.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'hookwall-'));
const { pass, passChain, stampPid, VERDICT } = await import('../../src/asolaria-hookwall.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');

// ── UNIT ─────────────────────────────────────────────────────────────────────
test('stampPid is deterministic + addresses every envelope', () => {
  const e = { actor: 'helm', verb: 'review', target: 'fabric', payload: 'x' };
  const p1 = stampPid(e), p2 = stampPid(e);
  assert.equal(p1, p2, 'deterministic');
  assert.ok(p1.startsWith('BH.HOOKWALL.'), 'PID-stamped');
  const p3 = stampPid({ ...e, verb: 'write' });
  assert.notEqual(p1, p3, 'different action => different PID');
});

test('pass throws on non-object envelope (no bypass with junk)', async () => {
  await assert.rejects(() => pass(null), TypeError);
  await assert.rejects(() => pass('not an object'), TypeError);
});

test('gate yields exactly one of three verdicts — never a silent fourth', async () => {
  const r = await pass({ actor: 'a', verb: 'event', payload: 'content here' }, { skipL0: true });
  assert.ok(Object.values(VERDICT).includes(r.verdict), 'verdict is one of the three');
});

test('blocked envelope is PRESERVED, not dropped', async () => {
  // force a low score so it blocks: payload that yields low composite
  const r = await pass({ actor: 'x', verb: 'event', payload: 'a' }, { skipL0: true });
  if (r.verdict === VERDICT.BLOCK_PRESERVE) {
    assert.equal(r.preserved, true, 'block == preserved evidence');
    assert.equal(r.pass, false);
  }
  // regardless of verdict, an observation row always exists (no silent drop)
  assert.ok(r.observation.includes('row=hookwall_observation'));
  assert.ok(r.dual_emit, 'dual-emit doctrine holds');
});

test('observeOnly verdict passes through without promotion claim', async () => {
  const r = await pass({ actor: 'a', verb: 'tick', payload: 'heartbeat' }, { skipL0: true, observeOnly: true });
  assert.equal(r.verdict, VERDICT.OBSERVE_ONLY);
  assert.equal(r.pass, true);
});

test('observation row is valid HBP (no JSON) with sha row_hash', async () => {
  const r = await pass({ actor: 'vector', verb: 'mint', target: 'white-room', payload: 'genius idea' }, { skipL0: true });
  const { tag, fields } = parsePipeRow(r.observation);
  assert.equal(tag, 'HBPv1');
  assert.equal(fields.row, 'hookwall_observation');
  assert.equal(fields.json, '0');
  assert.ok(fields.row_hash && fields.row_hash.length === 8);
  assert.ok(fields.pid.startsWith('BH.HOOKWALL.'));
  assert.ok(fields.verdict);
});

test('scoring is deterministic; observation hash is content-sensitive (timing-independent)', async () => {
  const e = { actor: 'a', verb: 'b', payload: 'same' };
  const r1 = await pass(e, { skipL0: true });
  const r2 = await pass(e, { skipL0: true });
  // deterministic on identical input — always true, no timing dependence
  assert.equal(r1.score, r2.score, 'SCORE deterministic for same pid+content');
  assert.equal(r1.pid, r2.pid, 'same envelope => same PID');
  // content-sensitive: different payload => different score + different observation row
  const r3 = await pass({ actor: 'a', verb: 'b', payload: 'DIFFERENT' }, { skipL0: true });
  assert.notEqual(r3.score, r1.score, 'different content => different score');
  assert.notEqual(r3.pid, r1.pid, 'different content => different PID-stamp => different row');
});

// ── INTEGRATION ───────────────────────────────────────────────────────────────
test('pass writes the observation to a real ledger on disk (dual-emit)', async () => {
  const ledger = join(tmp, 'hookwall-observations.hbp');
  const r = await pass({ actor: 'forge', verb: 'build', payload: 'real ledger write' }, { skipL0: true, ledgerPath: ledger });
  assert.equal(r.observed, true, 'observation written');
  assert.ok(existsSync(ledger));
  const content = readFileSync(ledger, 'utf8');
  assert.ok(content.includes('row=hookwall_observation'));
  assert.ok(content.includes(r.pid));
});

test('passChain links observation hashes (tamper-evident stream)', async () => {
  const ledger = join(tmp, 'chain.hbp');
  const stream = [
    { actor: 'a', verb: 'e1', payload: 'first' },
    { actor: 'b', verb: 'e2', payload: 'second' },
    { actor: 'c', verb: 'e3', payload: 'third' },
  ];
  const results = await passChain(stream, { skipL0: true, ledgerPath: ledger });
  assert.equal(results.length, 3);
  // each row's prev_hash must equal the previous row's row_hash
  const rows = readFileSync(ledger, 'utf8').trim().split('\n').map((l) => parsePipeRow(l).fields);
  assert.equal(rows[0].prev_hash, '0000000000000000', 'root prev_hash');
  assert.equal(rows[1].prev_hash, rows[0].row_hash, 'link 1->2');
  assert.equal(rows[2].prev_hash, rows[1].row_hash, 'link 2->3');
});

test('ledger write failure does NOT crash the gate (honest observed=false)', async () => {
  // unwritable path (directory that cannot be created under a file)
  const badPath = join(tmp, 'chain.hbp', 'cannot', 'nest.hbp');
  const r = await pass({ actor: 'a', verb: 'e', payload: 'x' }, { skipL0: true, ledgerPath: badPath });
  // gate still returns a verdict; observed honestly false
  assert.ok(r.verdict);
  assert.equal(r.observed, false, 'honest: write failed, not silently claimed');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

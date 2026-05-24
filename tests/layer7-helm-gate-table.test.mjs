// Pins: gate table classifies operations correctly so the helm defers to apex /
// operator-witness on hard-gated ops, never silently bypassing.
// Spec: AGENT.md Step 7 (gates) — operator-witness, apex-mint, bilateral-sync.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOp, requiresWitness, requiresApex, isFreeOp } from '../src/gate-table.mjs';

test('USB physical write requires operator-witness', () => {
  const c = classifyOp({ verb: 'file-write', target: 'F:/something.bin', usb: true });
  assert.equal(requiresWitness(c), true);
  assert.equal(isFreeOp(c), false);
});

test('SOVLINUX-2TB writes require operator-witness regardless of subverb', () => {
  for (const verb of ['file-write', 'file-append', 'ledger-append']) {
    const c = classifyOp({ verb, target: 'SOVLINUX-2TB:/data/canon.hbp' });
    assert.equal(requiresWitness(c), true, `${verb} → SOVLINUX must require witness`);
  }
});

test('cp mint requires apex (subset of quintuple)', () => {
  const c = classifyOp({ verb: 'cp-mint', target: 'PROF-NEW-CITIZEN-001' });
  assert.equal(requiresApex(c), true);
});

test('daemon-start requires operator-witness', () => {
  const c = classifyOp({ verb: 'daemon-start', target: ':4971' });
  assert.equal(requiresWitness(c), true);
});

test('MEMORY.md write requires operator-witness', () => {
  const c = classifyOp({
    verb: 'file-write',
    target: 'C:/Users/acer/.claude/projects/D--bigpickle-rebuild/memory/MEMORY.md',
  });
  assert.equal(requiresWitness(c), true);
});

test('regular file-write on D: is a free op', () => {
  const c = classifyOp({ verb: 'file-write', target: 'D:/bigpickle-rebuild/src/foo.mjs' });
  assert.equal(isFreeOp(c), true);
  assert.equal(requiresWitness(c), false);
  assert.equal(requiresApex(c), false);
});

test('PR push to github is operator-witness gated', () => {
  const c = classifyOp({ verb: 'git-push', target: 'github.com/JesseBrown1980/bigpickle-rebuild' });
  assert.equal(requiresWitness(c), true);
});

test('read-only ops are free', () => {
  for (const verb of ['file-read', 'fabric-query', 'directory-list']) {
    const c = classifyOp({ verb, target: 'anywhere' });
    assert.equal(isFreeOp(c), true, `${verb} must be free`);
  }
});

// Pins: successive .next() calls on one revolver yield distinct PIDs.
// Spec: project_bigpickle_pid_chain_revolver_canonical_multiplex_pattern_2026_05_24

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIDChainRevolver } from '../src/pid-chain-revolver.mjs';

test('100 successive .next() calls yield 100 distinct PIDs', () => {
  const r = new PIDChainRevolver({ anchor: 'oc-child-001' });
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(r.next());
  assert.equal(seen.size, 100);
});

test('PIDs are sha16 hex form', () => {
  const r = new PIDChainRevolver({ anchor: 'oc-child-001' });
  for (let i = 0; i < 10; i++) assert.match(r.next(), /^[a-f0-9]{16}$/);
});

test('two revolvers with different anchors produce disjoint sequences', () => {
  const a = new PIDChainRevolver({ anchor: 'anchor-A' });
  const b = new PIDChainRevolver({ anchor: 'anchor-B' });
  const seenA = new Set();
  const seenB = new Set();
  for (let i = 0; i < 50; i++) {
    seenA.add(a.next());
    seenB.add(b.next());
  }
  for (const pid of seenA) assert.ok(!seenB.has(pid), `collision: ${pid}`);
});

test('reset() restarts the counter; same sequence reproduced', () => {
  const r = new PIDChainRevolver({ anchor: 'reset-test' });
  const first = Array.from({ length: 5 }, () => r.next());
  r.reset();
  const second = Array.from({ length: 5 }, () => r.next());
  assert.deepEqual(second, first);
});

test('two revolvers with the same anchor produce the same sequence', () => {
  const a = new PIDChainRevolver({ anchor: 'shared' });
  const b = new PIDChainRevolver({ anchor: 'shared' });
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

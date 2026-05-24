// Pins: port routing is O(K) prefix-walk, not O(N^K) scan.
// Spec: 02-PORT-NAMESPACE-CANON.md ("Routing-table lookup is O(K) prefix-walk")
//
// RED phase expected: src/port-router.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortRouter } from '../src/port-router.mjs';

test('routing a label of depth K touches exactly K nodes', () => {
  const router = new PortRouter();
  router.register('50001.a', () => 'leaf-a');
  router.register('50001.a.b', () => 'leaf-ab');
  router.register('50001.a.b.c', () => 'leaf-abc');

  const trace = router.routeWithTrace('50001.a.b.c');
  assert.equal(trace.handler(), 'leaf-abc');
  // Trace includes one node per label segment (root + 3 segments = 4 nodes touched).
  assert.equal(trace.nodesVisited, 4, 'must visit root + K segments only');
});

test('routing is O(K), not O(N^K) — adding sibling labels does not slow lookup', () => {
  const router = new PortRouter();
  // Register 10 000 sibling labels under one parent.
  for (let i = 0; i < 10_000; i++) {
    router.register(`50001.parent.child-${i}`, () => i);
  }
  router.register('50001.parent.target', () => 'found');

  const t0 = process.hrtime.bigint();
  const handler = router.route('50001.parent.target');
  const t1 = process.hrtime.bigint();

  assert.equal(handler(), 'found');
  const microseconds = Number(t1 - t0) / 1000;
  // 10 000 siblings under one parent — O(K=3) lookup must stay sub-millisecond.
  assert.ok(microseconds < 1000, `routing took ${microseconds} µs; expected < 1000`);
});

test('one socket multiplexes infinite labels — no per-label socket allocated', () => {
  const router = new PortRouter();
  for (let i = 0; i < 1000; i++) {
    router.register(`50001.${i}`, () => i);
  }
  // PortRouter exposes a single underlying transport surface.
  assert.equal(router.transportCount, 1, 'PortRouter must use one transport for all labels');
});

test('unknown label routes return null, not throw', () => {
  const router = new PortRouter();
  router.register('50001.a', () => 'leaf-a');
  assert.equal(router.route('50001.nope'), null);
  assert.equal(router.route('50001.a.nope'), null);
});

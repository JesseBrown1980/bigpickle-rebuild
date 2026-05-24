// Pins: GC fires automatically every 2000 emits; not before, not after.
// Spec: collector-state.json field gcEveryMessages = 2000 (live default).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GCRuntime } from '../src/gc-runtime.mjs';

test('no gulp before 2000 emits', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 1999; i++) gc.emit();
  assert.equal(gc.runs, 0);
  assert.equal(gc.sinceLastGulp, 1999);
});

test('exactly one gulp at the 2000th emit', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 2000; i++) gc.emit();
  assert.equal(gc.runs, 1);
  assert.equal(gc.sinceLastGulp, 0);
  assert.equal(gc.lastGulpReason, 'auto_threshold');
});

test('5 gulps at 10K emits (the canonical 10K-agent checkpoint)', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 10_000; i++) gc.emit();
  assert.equal(gc.runs, 5);
});

test('cli_manual gulp updates lastGulpReason and resets counter', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 500; i++) gc.emit();
  gc.gulp('cli_manual');
  assert.equal(gc.runs, 1);
  assert.equal(gc.lastGulpReason, 'cli_manual');
  assert.equal(gc.sinceLastGulp, 0);
});

test('onGulp callback fires with run number and reason', () => {
  const calls = [];
  const gc = new GCRuntime({ onGulp: (info) => calls.push(info) });
  for (let i = 0; i < 4000; i++) gc.emit();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.runs), [1, 2]);
  assert.ok(calls.every((c) => c.reason === 'auto_threshold'));
});

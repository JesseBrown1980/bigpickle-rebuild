// Pins: sustained emission keeps file count below the warn threshold.
// Spec: "answer is BETTER GC, not LIMITERS" — first-success harddrive-explosion
// lesson (project_bigpickle_http_tracker_bypass_and_ramp_pattern_2026_05_24).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GCRuntime } from '../src/gc-runtime.mjs';

test('100 sustained emits stay well below warn threshold', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 100; i++) gc.emit();
  assert.equal(gc.status().capStatus, 'pass');
  assert.ok(gc.fileCount < gc.fileCapWarnAt);
});

test('10K sustained emits never breach the cap (capStatus = pass)', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 10_000; i++) {
    const status = gc.emit();
    assert.notEqual(status.capStatus, 'fail', `cap breached at i=${i}`);
  }
});

test('100K sustained emits trigger 50 gulps and never go fail', () => {
  const gc = new GCRuntime();
  for (let i = 0; i < 100_000; i++) gc.emit();
  assert.equal(gc.runs, 50);
  assert.notEqual(gc.status().capStatus, 'fail');
});

test('lowering gcEveryMessages tightens the flow without changing the invariant', () => {
  const gc = new GCRuntime({ gcEveryMessages: 200, fileCapWarnAt: 180, fileCapMax: 200 });
  for (let i = 0; i < 10_000; i++) gc.emit();
  assert.equal(gc.runs, 50);
  assert.notEqual(gc.status().capStatus, 'fail');
});

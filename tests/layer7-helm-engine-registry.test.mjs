// Pins: engine registry resolves engines by name from a JSON manifest, validates
// paths/URLs, and reports liveness without crashing on missing engines.
// Spec: TESTS-PLAN.md Layer 7 — engines may live on any drive or be HTTP URLs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEngineRegistry, resolveEngine, registryEntries } from '../src/engine-registry.mjs';

function tmpRegistry(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'helm-reg-'));
  const path = join(dir, 'helm-engines.json');
  writeFileSync(path, JSON.stringify({ engines: entries }, null, 2));
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('loadEngineRegistry reads a JSON manifest and exposes entries', () => {
  const { path, cleanup } = tmpRegistry([
    { name: 'aot-runner', kind: 'file', path: 'D:/bigpickle-rebuild/src/aot-runner.mjs' },
    { name: 'tool-advisor', kind: 'http', url: 'http://192.168.1.17:4944/api/tool-advisor' },
  ]);
  try {
    const reg = loadEngineRegistry(path);
    const names = registryEntries(reg).map((e) => e.name);
    assert.deepEqual(names.sort(), ['aot-runner', 'tool-advisor']);
  } finally {
    cleanup();
  }
});

test('resolveEngine returns entry by name', () => {
  const { path, cleanup } = tmpRegistry([
    { name: 'triple-quant', kind: 'file', path: 'C:/HyperBEHCS/lib/hyperbehcs-core.cjs' },
  ]);
  try {
    const reg = loadEngineRegistry(path);
    const eng = resolveEngine(reg, 'triple-quant');
    assert.equal(eng.kind, 'file');
    assert.equal(eng.path, 'C:/HyperBEHCS/lib/hyperbehcs-core.cjs');
  } finally {
    cleanup();
  }
});

test('resolveEngine on unknown name returns null (no throw)', () => {
  const { path, cleanup } = tmpRegistry([{ name: 'real-engine', kind: 'file', path: 'X:/nope.mjs' }]);
  try {
    const reg = loadEngineRegistry(path);
    assert.equal(resolveEngine(reg, 'nonexistent'), null);
  } finally {
    cleanup();
  }
});

test('registry rejects entries missing required fields', () => {
  const { path, cleanup } = tmpRegistry([{ name: 'bad-entry' }]); // no kind, no path/url
  try {
    assert.throws(() => loadEngineRegistry(path), /kind/);
  } finally {
    cleanup();
  }
});

test('registry accepts both file and http engine kinds', () => {
  const { path, cleanup } = tmpRegistry([
    { name: 'f1', kind: 'file', path: 'D:/x.mjs' },
    { name: 'h1', kind: 'http', url: 'http://127.0.0.1:4951' },
  ]);
  try {
    const reg = loadEngineRegistry(path);
    assert.equal(resolveEngine(reg, 'f1').kind, 'file');
    assert.equal(resolveEngine(reg, 'h1').kind, 'http');
  } finally {
    cleanup();
  }
});

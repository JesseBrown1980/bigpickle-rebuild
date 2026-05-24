// Pins: supervisor processes one job end-to-end with the full canonical cycle:
// PID mint via revolver → 47D tuple fill → hookwall pass → worker spawn → HBP
// envelope emit with sidecar trinity → GNN edge (parent→child) → manifest
// moved to done/.
//
// Spec: TESTS-PLAN.md Layer 7. Uses mock backend (claude-cli credit-gated).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSupervisor, tickOnce } from '../src/helm-supervisor.mjs';

function tmpQueue() {
  const root = mkdtempSync(join(tmpdir(), 'helm-q-'));
  for (const sub of ['in', 'done', 'failed', 'out', 'hbp']) {
    mkdirSync(join(root, sub), { recursive: true });
    writeFileSync(join(root, sub, '.keep'), '');
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function dropJob(qroot, name, body) {
  writeFileSync(join(qroot, 'in', `${name}.json`), JSON.stringify(body, null, 2));
}

function listDir(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((f) => f !== '.keep');
}

test('supervisor processes one job end-to-end, moves manifest to done/', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    dropJob(root, 'job-001', { verb: 'sanity-check', workdir: root, prompt: 'ping' });
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    const res = await tickOnce(sup);
    assert.equal(res.processed, 1);
    assert.equal(res.failed, 0);
    assert.deepEqual(listDir(join(root, 'in')), []);
    assert.equal(listDir(join(root, 'done')).length, 1);
  } finally {
    cleanup();
  }
});

test('each processed job gets a unique PID from the revolver', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    for (let i = 0; i < 3; i++) {
      dropJob(root, `job-${i}`, { verb: 'sanity-check', workdir: root, prompt: `p${i}` });
    }
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    const seen = new Set();
    for (let i = 0; i < 3; i++) {
      const res = await tickOnce(sup);
      assert.equal(res.processed, 1);
      const receipt = JSON.parse(readFileSync(join(root, 'done', `job-${i}.json`), 'utf8'));
      assert.ok(receipt.pid, `job-${i} missing pid`);
      assert.ok(!seen.has(receipt.pid), `pid collision: ${receipt.pid}`);
      seen.add(receipt.pid);
    }
    assert.equal(seen.size, 3);
  } finally {
    cleanup();
  }
});

test('failed worker moves manifest to failed/ with error captured', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    dropJob(root, 'job-bad', { verb: 'sanity-check', workdir: root, prompt: 'x', forceFail: true });
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    const res = await tickOnce(sup);
    assert.equal(res.processed, 0);
    assert.equal(res.failed, 1);
    assert.equal(listDir(join(root, 'failed')).length, 1);
    const receipt = JSON.parse(readFileSync(join(root, 'failed', 'job-bad.json'), 'utf8'));
    assert.ok(receipt.error, 'failed receipt must carry error');
  } finally {
    cleanup();
  }
});

test('per-job HBP envelope + sidecar trinity written to hbp/', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    dropJob(root, 'job-hbp', { verb: 'sanity-check', workdir: root, prompt: 'p' });
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    await tickOnce(sup);
    const hbpFiles = listDir(join(root, 'hbp'));
    assert.ok(hbpFiles.some((f) => f.endsWith('.hbp')), `no .hbp in ${hbpFiles.join(',')}`);
    assert.ok(hbpFiles.some((f) => f.endsWith('.hbi')), 'no .hbi sidecar');
    assert.ok(hbpFiles.some((f) => f.endsWith('.sha256')), 'no .sha256 sidecar');
  } finally {
    cleanup();
  }
});

test('witness-gated job is deferred, not auto-executed', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    dropJob(root, 'job-gated', {
      verb: 'daemon-start',
      target: ':4971',
      workdir: root,
      prompt: 'restart daemon',
    });
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    const res = await tickOnce(sup);
    assert.equal(res.processed, 0);
    assert.equal(res.deferred, 1, 'witness-gated job must be deferred not executed');
  } finally {
    cleanup();
  }
});

test('tickOnce is a no-op when in/ is empty', async () => {
  const { root, cleanup } = tmpQueue();
  try {
    const sup = createSupervisor({ queueRoot: root, backend: 'mock' });
    const res = await tickOnce(sup);
    assert.equal(res.processed, 0);
    assert.equal(res.failed, 0);
    assert.equal(res.deferred, 0);
  } finally {
    cleanup();
  }
});

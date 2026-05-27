// cosign-chain-writer-lock — unit tests.
//
// Canon: A12 archaeology seq=250 4-way collision class; round-2 R-agent
// ship-queue #1; canon-correction d94d89d53c324765.
//
// Tests use temporary lock files under os.tmpdir() to avoid polluting the
// repo. Each test cleans up its own lock file.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  withChainWriterLock,
  defaultLockPathFor,
  STATUS,
} from '../src/cosign-chain-writer-lock.mjs';

// === Test fixture: unique lock path per test ============================

function freshLockPath(label) {
  const stamp = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  return path.join(os.tmpdir(), `bp-writer-lock-${label}-${stamp}.lock`);
}

async function safeUnlink(p) {
  try { await fs.unlink(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

// === STATUS surface =====================================================

describe('cosign-chain-writer-lock — STATUS surface', () => {
  test('STATUS is frozen and declares schema + canon refs', () => {
    assert.ok(Object.isFrozen(STATUS));
    assert.equal(STATUS.schema, 'cosign-chain-writer-lock.v1');
    assert.equal(STATUS.default_acquire_timeout_ms, 5000);
    assert.equal(STATUS.default_stale_lock_ms, 30_000);
    assert.ok(Array.isArray(STATUS.canon_refs));
    assert.ok(STATUS.canon_refs.some((r) => /A12/.test(r)));
    assert.ok(STATUS.canon_refs.some((r) => /round-2 R/.test(r)));
    assert.match(STATUS.closes_anti_pattern, /seq.?250|4.?way/i);
  });
});

// === Test 1: single writer holds lock + releases cleanly ================

describe('cosign-chain-writer-lock — Test 1: single writer holds + releases', () => {
  test('lock file is created during fn() then deleted on return', async () => {
    const lockPath = freshLockPath('test1');
    let lockExistedDuringFn = false;

    const result = await withChainWriterLock(lockPath, async () => {
      // During fn(), the lock file should exist on disk.
      try {
        await fs.access(lockPath);
        lockExistedDuringFn = true;
      } catch (_) {
        lockExistedDuringFn = false;
      }
      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(lockExistedDuringFn, true, 'lock file should exist during fn() execution');

    // After return, lock file should be gone.
    await assert.rejects(fs.access(lockPath), { code: 'ENOENT' });
  });
});

// === Test 2: second writer blocks while first holds =====================

describe('cosign-chain-writer-lock — Test 2: second writer blocks', () => {
  test('writer B does not enter fn() until writer A releases', async () => {
    const lockPath = freshLockPath('test2');
    const events = [];
    let aReleaseGate; const aReleasePromise = new Promise((r) => { aReleaseGate = r; });

    const writerA = withChainWriterLock(lockPath, async () => {
      events.push('A-enter');
      await aReleasePromise; // hold lock until we explicitly let it go
      events.push('A-exit');
      return 'A';
    });

    // Give A a tick to acquire the lock first.
    await new Promise((r) => setTimeout(r, 20));

    const writerB = withChainWriterLock(
      lockPath,
      async () => {
        events.push('B-enter');
        return 'B';
      },
      { acquireTimeoutMs: 5000, retryBackoffMs: 10 },
    );

    // At this point: A is in fn(), B is in acquisition loop. B should NOT have entered.
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(events, ['A-enter'], 'B must not enter until A releases');

    // Release A; B should now proceed.
    aReleaseGate();
    const [resA, resB] = await Promise.all([writerA, writerB]);

    assert.equal(resA, 'A');
    assert.equal(resB, 'B');
    assert.deepEqual(events, ['A-enter', 'A-exit', 'B-enter'], 'ordering must be A-enter, A-exit, B-enter');

    await safeUnlink(lockPath);
  });
});

// === Test 3: acquisition timeout throws RangeError ======================

describe('cosign-chain-writer-lock — Test 3: acquisition timeout', () => {
  test('throws RangeError when first writer holds longer than timeout', async () => {
    const lockPath = freshLockPath('test3');
    let releaseHolder;
    const holderRelease = new Promise((r) => { releaseHolder = r; });

    // Holder grabs the lock and waits.
    const holder = withChainWriterLock(lockPath, async () => {
      await holderRelease;
      return 'held';
    });

    // Give holder time to acquire.
    await new Promise((r) => setTimeout(r, 30));

    // Second writer attempts with a short timeout; should reject with RangeError.
    await assert.rejects(
      withChainWriterLock(
        lockPath,
        async () => 'should-never-run',
        { acquireTimeoutMs: 100, retryBackoffMs: 20 },
      ),
      (err) => {
        assert.ok(err instanceof RangeError, 'expected RangeError');
        assert.match(err.message, /timed out after 100ms/);
        return true;
      },
    );

    // Let the holder finish to keep test clean.
    releaseHolder();
    await holder;
    await safeUnlink(lockPath);
  });
});

// === Test 4: stale-lock detection releases crashed-holder lock ==========

describe('cosign-chain-writer-lock — Test 4: stale-lock detection', () => {
  test('lock with mtime > staleLockMs is stolen and new writer proceeds', async () => {
    const lockPath = freshLockPath('test4');

    // Simulate a crashed writer: write a lock file with old mtime (60s in the past).
    await fs.writeFile(lockPath, JSON.stringify({ schema: 'cosign-chain-writer-lock.v1', pid: 999999, acquired_ts_ms: Date.now() - 60_000, host_argv: ['fake'] }));
    const oldTime = (Date.now() - 60_000) / 1000;
    await fs.utimes(lockPath, oldTime, oldTime);

    // New writer with staleLockMs=1000 should detect this as stale and steal.
    const result = await withChainWriterLock(
      lockPath,
      async () => 'recovered',
      { acquireTimeoutMs: 2000, staleLockMs: 1000, retryBackoffMs: 10 },
    );

    assert.equal(result, 'recovered');
    // Lock should be gone after release.
    await assert.rejects(fs.access(lockPath), { code: 'ENOENT' });
  });
});

// === Test 5: returned value matches fn() return =========================

describe('cosign-chain-writer-lock — Test 5: return value passthrough', () => {
  test('primitive return value passes through', async () => {
    const lockPath = freshLockPath('test5a');
    const result = await withChainWriterLock(lockPath, () => 42);
    assert.equal(result, 42);
  });

  test('object return value passes through', async () => {
    const lockPath = freshLockPath('test5b');
    const obj = { seq: 251, row_hash: 'abc1234567890def' };
    const result = await withChainWriterLock(lockPath, async () => obj);
    assert.deepEqual(result, obj);
  });

  test('undefined return passes through', async () => {
    const lockPath = freshLockPath('test5c');
    const result = await withChainWriterLock(lockPath, () => undefined);
    assert.equal(result, undefined);
  });
});

// === Test 6: error in fn() still releases lock (try/finally) ============

describe('cosign-chain-writer-lock — Test 6: error releases lock', () => {
  test('fn() throw releases lock and re-throws to caller', async () => {
    const lockPath = freshLockPath('test6');

    await assert.rejects(
      withChainWriterLock(lockPath, async () => {
        throw new Error('simulated cosign-append failure');
      }),
      /simulated cosign-append failure/,
    );

    // Lock file should be gone even though fn() threw.
    await assert.rejects(fs.access(lockPath), { code: 'ENOENT' });

    // Subsequent acquire should succeed (lock not orphaned).
    const result = await withChainWriterLock(lockPath, async () => 'after-error');
    assert.equal(result, 'after-error');
  });
});

// === Input-validation ===================================================

describe('cosign-chain-writer-lock — input validation', () => {
  test('empty lockPath throws TypeError', async () => {
    await assert.rejects(withChainWriterLock('', () => 1), TypeError);
    await assert.rejects(withChainWriterLock(null, () => 1), TypeError);
  });

  test('non-function fn throws TypeError', async () => {
    const lockPath = freshLockPath('validation-fn');
    await assert.rejects(withChainWriterLock(lockPath, null), TypeError);
    await assert.rejects(withChainWriterLock(lockPath, 'not-a-function'), TypeError);
  });

  test('negative acquireTimeoutMs throws RangeError', async () => {
    const lockPath = freshLockPath('validation-timeout');
    await assert.rejects(
      withChainWriterLock(lockPath, () => 1, { acquireTimeoutMs: -1 }),
      RangeError,
    );
  });

  test('non-positive staleLockMs throws RangeError', async () => {
    const lockPath = freshLockPath('validation-stale');
    await assert.rejects(
      withChainWriterLock(lockPath, () => 1, { staleLockMs: 0 }),
      RangeError,
    );
  });
});

// === defaultLockPathFor helper ==========================================

describe('cosign-chain-writer-lock — defaultLockPathFor helper', () => {
  test('builds lock path from chainId + baseDir', () => {
    const p = defaultLockPathFor('asolaria:cosign:chain', '/tmp');
    assert.ok(p.endsWith('.lock'));
    assert.ok(p.includes('asolaria_cosign_chain'));
  });

  test('rejects empty chainId', () => {
    assert.throws(() => defaultLockPathFor('', '/tmp'), TypeError);
  });
});

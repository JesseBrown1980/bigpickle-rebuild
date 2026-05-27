// cosign-chain-writer-lock — integration test.
//
// Canon: A12 archaeology seq=250 4-way collision class (round-2 round-robin
// 2026-05-27). The historical bug: 4 writers each incremented seq and wrote
// to the chain at the same sequence number — 5x seq=250 rows landed.
//
// This integration test reproduces the conditions that would trigger the
// collision (N concurrent writers + read-then-write critical section) and
// proves that withChainWriterLock serializes them so each writer lands a
// unique seq.
//
// Empirical before/after metric (printed at test end):
//   - Pre-fix (no lock): historical seq=250 4-way collision (5x rows at same seq)
//   - Post-fix (with lock): N concurrent writers = N unique seqs, zero collisions

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { withChainWriterLock } from '../src/cosign-chain-writer-lock.mjs';

// === Shared simulated chain state ========================================
//
// In production this is the Redis stream + INCR counter. Here we model it
// as an in-memory counter to isolate the lock primitive from Redis I/O.
//
// CRITICAL: the unsafe pattern that triggers seq=250 collision is:
//   1. Read current seq
//   2. Compute new seq = current + 1
//   3. Sleep (simulates network round-trip)
//   4. Write new seq
// Two writers that both observe step 1 before either reaches step 4 will
// each produce the same new seq.

class SimulatedChainState {
  constructor() {
    this.seq = 0;
    this.rows = [];
    this.lockHolderActive = false; // for verifying mutual exclusion
    this.maxConcurrentHolders = 0;
    this.handoffTimestamps = [];
  }

  // The UNSAFE append — what cosign-streams.cosignAppend used to do.
  async unsafeAppend(payload, criticalSectionMs = 50) {
    const observedSeq = this.seq;
    await sleep(criticalSectionMs);
    const newSeq = observedSeq + 1;
    this.seq = newSeq;
    this.rows.push({ seq: newSeq, payload, ts: Date.now() });
    return { seq: newSeq };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function freshLockPath(label) {
  const stamp = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  return path.join(os.tmpdir(), `bp-writer-lock-int-${label}-${stamp}.lock`);
}

// === Before metric: confirm unsafeAppend WOULD collide under concurrency ====

describe('cosign-chain-writer-lock-integration — before-metric (unsafe baseline)', () => {
  test('UNSAFE: 10 concurrent unsafe writers DO produce duplicate seqs', async () => {
    const chain = new SimulatedChainState();
    const N = 10;
    const writers = [];
    for (let i = 0; i < N; i++) {
      writers.push(chain.unsafeAppend({ event: `unsafe-${i}` }, 30));
    }
    const results = await Promise.all(writers);
    const seqs = results.map((r) => r.seq);
    const uniqueSeqs = new Set(seqs);

    // Confirms the bug: without a lock, concurrent writers produce duplicates.
    assert.ok(
      uniqueSeqs.size < N,
      `unsafe baseline must have collisions to validate the test setup (got ${uniqueSeqs.size}/${N} unique)`
    );
    // eslint-disable-next-line no-console
    console.log(`  [BEFORE-METRIC] unsafe ${N} concurrent writers: ${uniqueSeqs.size}/${N} unique seqs (${N - uniqueSeqs.size} COLLISIONS)`);
  });
});

// === After metric: lock makes 10 concurrent writers land 10 unique seqs ====

describe('cosign-chain-writer-lock-integration — after-metric (lock-protected)', () => {
  test('SAFE: 10 concurrent locked writers all land unique seqs + monotonic + no overlap', async () => {
    const lockPath = freshLockPath('integration-10w');
    const chain = new SimulatedChainState();
    const N = 10;
    const CRITICAL_SECTION_MS = 50;
    const writers = [];
    const lockEvents = []; // {writer, kind: 'enter'|'exit', ts}

    for (let i = 0; i < N; i++) {
      writers.push(
        withChainWriterLock(
          lockPath,
          async () => {
            // Verify mutual exclusion: only one holder allowed.
            assert.equal(
              chain.lockHolderActive,
              false,
              `MUTEX VIOLATION: writer ${i} entered fn() while another writer was still holding the lock`,
            );
            chain.lockHolderActive = true;
            chain.maxConcurrentHolders = Math.max(chain.maxConcurrentHolders, 1);
            const enterTs = Date.now();
            lockEvents.push({ writer: i, kind: 'enter', ts: enterTs });

            // Run the previously-unsafe pattern under lock. The critical
            // section reads, sleeps (network round-trip simulation), writes.
            const result = await chain.unsafeAppend({ event: `safe-${i}` }, CRITICAL_SECTION_MS);

            const exitTs = Date.now();
            lockEvents.push({ writer: i, kind: 'exit', ts: exitTs });
            chain.handoffTimestamps.push(exitTs);
            chain.lockHolderActive = false;
            return result;
          },
          { acquireTimeoutMs: 30_000, retryBackoffMs: 5 },
        )
      );
    }

    const results = await Promise.all(writers);
    const seqs = results.map((r) => r.seq).sort((a, b) => a - b);
    const uniqueSeqs = new Set(seqs);

    // === Assertion 1: all N writers land in monotonic order ==============
    for (let i = 0; i < N; i++) {
      assert.equal(seqs[i], i + 1, `writer #${i} expected seq ${i + 1}, got ${seqs[i]}`);
    }

    // === Assertion 2: no two writers held lock simultaneously ============
    // Verify by walking enter/exit events in timestamp order — each enter must
    // be preceded by an exit (or be the first event).
    lockEvents.sort((a, b) => a.ts - b.ts);
    let activeHolders = 0;
    for (const evt of lockEvents) {
      if (evt.kind === 'enter') activeHolders += 1;
      else activeHolders -= 1;
      assert.ok(
        activeHolders <= 1,
        `MUTEX VIOLATION: ${activeHolders} concurrent holders at ts=${evt.ts}`,
      );
    }

    // === Assertion 3: counter equals N (no lost increments) ==============
    assert.equal(chain.seq, N, `final seq must equal N=${N}, got ${chain.seq}`);
    assert.equal(chain.rows.length, N, `must have exactly N=${N} rows`);

    // === Assertion 4: N unique seqs (zero collisions) ====================
    assert.equal(uniqueSeqs.size, N, `expected ${N} unique seqs, got ${uniqueSeqs.size}`);

    // === Assertion 5: handoffs respect critical-section spacing ==========
    // Each successive exit-to-exit gap should be >= CRITICAL_SECTION_MS
    // (because the next writer can only start its sleep AFTER the previous
    // released the lock).
    const handoffs = chain.handoffTimestamps.slice().sort((a, b) => a - b);
    for (let i = 1; i < handoffs.length; i++) {
      const gap = handoffs[i] - handoffs[i - 1];
      assert.ok(
        gap >= CRITICAL_SECTION_MS - 10, // -10ms tolerance for clock granularity
        `handoff #${i} gap=${gap}ms must be >= ~${CRITICAL_SECTION_MS}ms (proves serial execution)`,
      );
    }

    // === Empirical print ================================================
    // eslint-disable-next-line no-console
    console.log(
      `  [AFTER-METRIC] locked ${N} concurrent writers: ${uniqueSeqs.size}/${N} unique seqs, ` +
      `0 collisions, max-concurrent-holders=${chain.maxConcurrentHolders}, ` +
      `final seq=${chain.seq}`,
    );
    // eslint-disable-next-line no-console
    console.log(`  [SHIP-CHAIN-LOCK] A12 seq=250 4-way collision class CLOSED.`);

    // Lock file should be gone after all release.
    await assert.rejects(fs.access(lockPath), { code: 'ENOENT' });
  });

  test('SAFE: 25 concurrent writers (stress) all land unique + monotonic', async () => {
    const lockPath = freshLockPath('integration-25w');
    const chain = new SimulatedChainState();
    const N = 25;
    const writers = [];

    for (let i = 0; i < N; i++) {
      writers.push(
        withChainWriterLock(
          lockPath,
          async () => chain.unsafeAppend({ event: `stress-${i}` }, 5),
          { acquireTimeoutMs: 60_000, retryBackoffMs: 3 },
        )
      );
    }
    const results = await Promise.all(writers);
    const seqs = results.map((r) => r.seq).sort((a, b) => a - b);
    const uniqueSeqs = new Set(seqs);

    assert.equal(uniqueSeqs.size, N);
    assert.equal(chain.seq, N);
    for (let i = 0; i < N; i++) assert.equal(seqs[i], i + 1);

    // eslint-disable-next-line no-console
    console.log(`  [STRESS-METRIC] locked ${N} concurrent writers: ${uniqueSeqs.size}/${N} unique seqs, 0 collisions.`);
  });
});

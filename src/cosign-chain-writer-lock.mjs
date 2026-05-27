// Cosign-chain writer lock — single-writer flock at append step.
//
// === Canon antecedents ===================================================
//
// - A12 archaeology canon-finding (2026-05-27 round-2 round-robin wave):
//     seq=250 4-way collision class — multiple writers appended at the same
//     sequence simultaneously, producing 5x seq=250 rows in cosign chain.
//   Root cause: cosign-streams.cosignAppend() reads prevRowHash via XREVRANGE,
//   then INCRs seq, then XADDs the row — three separate Redis round-trips
//   with NO single-writer enforcement at the call site. Under concurrency,
//   N writers can each observe the same prev, compute the same row_hash, and
//   land on the same seq value (race between INCR and XADD).
//
// - 8+ round-2 R-agent ship-queue #1 (R01/R02/R06/R09/R11/R12/R17/R18):
//     "chain_writer_lock" ranked top priority across all senior reviewers.
//
// - Canon-correction d94d89d53c324765 + diagnosis row 748f2798f6fbb887.
//
// === Senior-SWE fix ======================================================
//
// File-level exclusive lock around the chain-append critical section, with:
//   1. Cross-platform atomic-rename fallback (no proper-lockfile dep — repo is
//      zero-deps per package.json; we use fs.open('wx') exclusive-create which
//      is atomic on POSIX + NTFS on Windows).
//   2. Stale-lock detection: if lock file is > 30s old, assume crashed writer
//      and steal the lock (mtime-based heuristic, not pid-based — pid recycling
//      is unreliable).
//   3. Acquisition timeout: throws RangeError after configurable timeout (5s
//      default) if lock cannot be acquired — surfaces hot-path contention to
//      caller rather than masking it as silent wait.
//   4. try/finally release: lock is always released, even on fn() exception.
//
// === Vantage scope =======================================================
//
// Local filesystem lock — ACER-VANTAGE-LOCAL by default (lockPath usually under
// C:/tmp/ or D:/bigpickle-rebuild/data/locks/). Liris-vantage equivalent uses
// her own lockPath. NOT a cross-vantage lock — cross-vantage durability is via
// TWIN-SEAL antecedents, not shared file locks.
//
// === Engineering-loop discipline =========================================
//
// Per Victor freeze 2026-05-26T20:18 + operator senior-SWE directive 2026-05-27:
// real patch + unit tests + integration tests + before/after metric. No new
// LAW/canon emission — pure correctness fix to close A12 4-way collision class.
//
// Pure-functional surface (no module-level state). All state is in the
// caller-owned lock file path.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_ACQUIRE_TIMEOUT_MS = 5000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const DEFAULT_RETRY_BACKOFF_MS = 25;

// withChainWriterLock(lockPath, fn, opts?)
//
// Acquires exclusive lock on lockPath, runs fn(), releases lock, returns
// fn's return value. Lock is held for the full duration of fn() (including
// awaited async work).
//
// args:
//   lockPath: absolute filesystem path to lock file (will be created/deleted
//             by this function; parent dir must exist).
//   fn:       async (or sync) zero-arg function whose execution is serialized.
//   opts:     {
//     acquireTimeoutMs: ms before throwing RangeError if lock unavailable
//                       (default 5000).
//     staleLockMs:      ms after which lock is considered stale and stolen
//                       (default 30000).
//     retryBackoffMs:   ms between retry attempts during acquisition
//                       (default 25).
//     now:              () => number — clock injection for tests.
//   }
//
// returns: whatever fn() returns (awaited if Promise).
//
// throws:
//   - TypeError if lockPath/fn invalid.
//   - RangeError if lock cannot be acquired within acquireTimeoutMs.
//   - re-throws any error fn() throws (after releasing lock).
export async function withChainWriterLock(lockPath, fn, opts = {}) {
  if (typeof lockPath !== 'string' || !lockPath) {
    throw new TypeError('withChainWriterLock: lockPath must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('withChainWriterLock: fn must be a function');
  }
  const acquireTimeoutMs = opts.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  const staleLockMs = opts.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const retryBackoffMs = opts.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();

  if (!Number.isFinite(acquireTimeoutMs) || acquireTimeoutMs < 0) {
    throw new RangeError(`withChainWriterLock: acquireTimeoutMs must be >= 0; got ${acquireTimeoutMs}`);
  }
  if (!Number.isFinite(staleLockMs) || staleLockMs <= 0) {
    throw new RangeError(`withChainWriterLock: staleLockMs must be > 0; got ${staleLockMs}`);
  }

  const deadline = now() + acquireTimeoutMs;
  let acquired = false;
  let attempts = 0;

  while (!acquired) {
    attempts += 1;
    try {
      // Atomic exclusive create — fails if file exists (cross-platform atomic
      // on POSIX + NTFS).
      const fh = await fs.open(lockPath, 'wx');
      const lockBody = JSON.stringify({
        schema: 'cosign-chain-writer-lock.v1',
        pid: process.pid,
        acquired_ts_ms: now(),
        host_argv: process.argv.slice(0, 3),
      });
      await fh.writeFile(lockBody, 'utf8');
      await fh.close();
      acquired = true;
      break;
    } catch (err) {
      // On POSIX, exclusive-create collision is EEXIST. On Windows/NTFS, brief
      // sharing-violation windows (Defender scan, concurrent unlink-then-open)
      // can surface as EPERM or EBUSY — treat all three as "lock is taken,
      // back off + retry" rather than fatal errors. Any other code is fatal.
      if (err.code !== 'EEXIST' && err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
      // Lock file appears taken — check staleness (if we can stat it).
      let stat = null;
      try {
        stat = await fs.stat(lockPath);
      } catch (statErr) {
        if (statErr.code !== 'ENOENT' && statErr.code !== 'EPERM' && statErr.code !== 'EBUSY') {
          throw statErr;
        }
        // Transient Windows lock OR holder released — fall through to retry.
      }
      const ageMs = stat ? now() - stat.mtimeMs : 0;
      if (stat && ageMs > staleLockMs) {
        // Stale lock — steal it via unlink + retry. Best-effort on Windows;
        // ENOENT/EPERM/EBUSY all mean "try again next iteration".
        try {
          await fs.unlink(lockPath);
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT' && unlinkErr.code !== 'EPERM' && unlinkErr.code !== 'EBUSY') {
            throw unlinkErr;
          }
        }
        continue;
      }
      // Lock is held + fresh (or transient Windows sharing-violation) — wait + retry.
      if (now() >= deadline) {
        throw new RangeError(
          `withChainWriterLock: lock acquisition timed out after ${acquireTimeoutMs}ms ` +
          `(lockPath=${lockPath}, attempts=${attempts}, holder_age_ms=${Math.round(ageMs)})`
        );
      }
      await sleep(retryBackoffMs);
    }
  }

  // Critical section — run fn() under exclusive lock; release in finally.
  try {
    return await fn();
  } finally {
    // Release with brief retry to absorb Windows sharing-violation transients.
    let released = false;
    for (let i = 0; i < 5 && !released; i++) {
      try {
        await fs.unlink(lockPath);
        released = true;
      } catch (unlinkErr) {
        if (unlinkErr.code === 'ENOENT') { released = true; break; }
        if (unlinkErr.code !== 'EPERM' && unlinkErr.code !== 'EBUSY') {
          // eslint-disable-next-line no-console
          console.warn('[cosign-chain-writer-lock] release unlink failed:', unlinkErr.message);
          break;
        }
        await sleep(retryBackoffMs);
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: derive default lock-path for a given chain identifier.
// Callers can use this OR pass an explicit lockPath.
export function defaultLockPathFor(chainId, baseDir) {
  if (typeof chainId !== 'string' || !chainId) {
    throw new TypeError('defaultLockPathFor: chainId must be a non-empty string');
  }
  const safe = chainId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = baseDir || path.join(process.cwd(), 'data', 'locks');
  return path.join(dir, `${safe}.lock`);
}

export const STATUS = Object.freeze({
  schema: 'cosign-chain-writer-lock.v1',
  default_acquire_timeout_ms: DEFAULT_ACQUIRE_TIMEOUT_MS,
  default_stale_lock_ms: DEFAULT_STALE_LOCK_MS,
  default_retry_backoff_ms: DEFAULT_RETRY_BACKOFF_MS,
  primitive: 'atomic-exclusive-create (fs.open wx) + stale-mtime detection',
  pairs_with: 'src/cosign-bridge.mjs cosignAppend / src/cosign-streams.mjs cosignAppend',
  closes_anti_pattern: 'A12-seq-250-4-way-collision (multiple writers landing same seq)',
  canon_refs: [
    'A12 archaeology canon-finding 2026-05-27',
    'round-2 R01/R02/R06/R09/R11/R12/R17/R18 ship-queue #1',
    'canon-correction d94d89d53c324765',
    'diagnosis row 748f2798f6fbb887',
  ],
  cross_platform: 'POSIX + NTFS atomic exclusive create — no proper-lockfile dep',
  spec: 'project_bigpickle_rebuild_chain_writer_lock_2026_05_27.md (pending)',
});

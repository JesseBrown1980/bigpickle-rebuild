// Helm supervisor — long-running orchestrator that watches a queue, processes
// jobs, and emits the full canonical envelope cycle for each one.
//
// Per-job cycle (maps to liris's 8-verb canonical decomposition):
//   1. pid-mint        : revolver mints a child PID from the helm parent
//   2. tuple-compose   : 47D tuple-tag filled
//   3. room-allocate   : queue manifest occupies its in/ slot
//   4. file-write      : worker stdout captured to out/
//   5. envelope-emit   : HBP envelope written with sidecar trinity to hbp/
//   6. ledger-append   : GNN edge parent→child appended; cosign-chain mirror
//                        deferred to the :4953 daemon (v2 wire-up)
//   7. receipt-emit    : done/ or failed/ receipt JSON
//   8. daemon-start    : N/A — operator-witness-gated, classifier defers it
//
// Tests drive this via tickOnce(); start() runs the real interval loop.

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mintPID } from './pid-minter.mjs';
import { PIDChainRevolver } from './pid-chain-revolver.mjs';
import { primeAt } from './primes.mjs';
import { Hookwall } from './hookwall.mjs';
import { GCRuntime } from './gc-runtime.mjs';
import { createGNNEdgeLedger } from './gnn-edge-ledger.mjs';
import { writeHBP } from './hbp-emitter.mjs';
import { TUPLE_DIMS } from './tuple-tag.mjs';
import { classifyOp, requiresWitness, requiresApex } from './gate-table.mjs';
import { createWorker, runJob } from './helm-worker.mjs';

const QUEUE_DIRS = ['in', 'done', 'failed', 'out', 'hbp'];

function ensureQueue(root) {
  for (const sub of QUEUE_DIRS) {
    const p = join(root, sub);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
}

function listJobs(qroot) {
  const inDir = join(qroot, 'in');
  if (!existsSync(inDir)) return [];
  return readdirSync(inDir).filter((f) => f.endsWith('.json')).sort();
}

function tupleForJob(parentPID, childPID, job) {
  const t = new Array(TUPLE_DIMS).fill('');
  t[0] = 'acer-helm-supervisor';        // D1  ACTOR
  t[1] = 'helm';                        // D2  lane / sup band
  t[14] = 'acer';                       // D15 device fingerprint slot
  t[15] = String(childPID);             // D16 child PID (the sha16)
  t[19] = new Date().toISOString();     // D20 timestamp
  t[20] = 'acer';                       // D21 vantage
  t[21] = String(parentPID);            // D22 parent PID
  t[28] = String(job?.verb ?? '');      // D29 verb
  t[29] = String(job?.workdir ?? '');   // D30 workdir
  t[30] = String(job?.target ?? '');    // D31 target
  return t;
}

export function createSupervisor(opts = {}) {
  if (!opts.queueRoot) throw new Error('createSupervisor: queueRoot required');
  ensureQueue(opts.queueRoot);

  const deviceAnchor = opts.deviceFingerprint ?? createHash('sha256').update('acer-helm-default').digest('hex').slice(0, 16);
  const parentPID = mintPID({
    actor: 0,
    device: deviceAnchor,
    lane: 'memory',
    prime: primeAt(0),
  });

  return {
    queueRoot: opts.queueRoot,
    parentPID,
    deviceAnchor,
    revolver: new PIDChainRevolver({ anchor: deviceAnchor }),
    hookwall: new Hookwall({ name: 'helm-supervisor' }),
    gc: new GCRuntime(),
    gnn: createGNNEdgeLedger(),
    worker: createWorker({ backend: opts.backend ?? 'mock' }),
    stats: { processed: 0, failed: 0, deferred: 0 },
  };
}

function moveTo(qroot, name, subdir, receipt) {
  const src = join(qroot, 'in', name);
  const dst = join(qroot, subdir, name);
  writeFileSync(dst, JSON.stringify(receipt, null, 2));
  try { unlinkSync(src); } catch { /* best-effort */ }
}

export async function tickOnce(sup) {
  const result = { processed: 0, failed: 0, deferred: 0, jobs: [] };
  const names = listJobs(sup.queueRoot);
  if (names.length === 0) return result;

  const name = names[0];
  const body = JSON.parse(readFileSync(join(sup.queueRoot, 'in', name), 'utf8'));

  // Gate check FIRST — defer witness/apex-gated jobs without spawning
  const classified = classifyOp({ verb: body.verb, target: body.target });
  if (requiresWitness(classified) || requiresApex(classified)) {
    sup.stats.deferred++;
    result.deferred = 1;
    moveTo(sup.queueRoot, name, 'failed', {
      pid: null,
      job: body,
      gate: classified.gate,
      ts: new Date().toISOString(),
      deferred: true,
      reason: classified.gate.reason || 'gate requires authorization',
    });
    result.jobs.push({ name, status: 'deferred' });
    return result;
  }

  // Step 1: pid-mint via revolver (returns sha16 string)
  const childPID = sup.revolver.next();

  // Step 2: tuple-compose
  const tuple = tupleForJob(sup.parentPID, childPID, body);

  // Step 3: hookwall — throws on reject
  try {
    sup.hookwall.pass({ type: 'helm.job', tupleTag: tuple, payload: body });
  } catch (err) {
    sup.stats.failed++;
    result.failed = 1;
    moveTo(sup.queueRoot, name, 'failed', {
      pid: childPID,
      job: body,
      ts: new Date().toISOString(),
      error: `hookwall: ${err.message}`,
    });
    return result;
  }

  // Step 4: run worker
  let workerResult;
  try {
    workerResult = await runJob(sup.worker, {
      prompt: body.prompt,
      workdir: body.workdir,
      forceFail: body.forceFail,
    });
  } catch (err) {
    workerResult = { exitCode: -1, stdout: '', stderr: String(err.message ?? err), backend: sup.worker.backend };
  }

  if (workerResult.exitCode !== 0) {
    sup.stats.failed++;
    result.failed = 1;
    moveTo(sup.queueRoot, name, 'failed', {
      pid: childPID,
      job: body,
      ts: new Date().toISOString(),
      error: workerResult.stderr || `exitCode=${workerResult.exitCode}`,
      stdout: workerResult.stdout,
      backend: workerResult.backend,
    });
    return result;
  }

  // Step 4b: persist stdout
  writeFileSync(join(sup.queueRoot, 'out', `${name}.out.txt`), workerResult.stdout);

  // Step 5: HBP envelope + sidecar trinity
  const stem = name.replace(/\.json$/, '');
  const hbpStem = join(sup.queueRoot, 'hbp', `${stem}-${childPID}`);
  writeHBP(hbpStem, {
    type: 'helm.job.result',
    tupleTag: tuple,
    payload: {
      job: body,
      pid: childPID,
      parentPID: sup.parentPID,
      exitCode: workerResult.exitCode,
      stdoutLen: workerResult.stdout.length,
      backend: workerResult.backend,
    },
  });

  // Step 6: GNN edge parent → child
  sup.gnn.append({ from: sup.parentPID, to: childPID, kind: 'helm-spawn', verb: body.verb });

  // Step 7: receipt-emit
  sup.stats.processed++;
  result.processed = 1;
  moveTo(sup.queueRoot, name, 'done', {
    pid: childPID,
    parentPID: sup.parentPID,
    job: body,
    ts: new Date().toISOString(),
    exitCode: workerResult.exitCode,
    backend: workerResult.backend,
    stdoutLen: workerResult.stdout.length,
    hbpStem,
  });
  result.jobs.push({ name, status: 'done', pid: childPID });
  return result;
}

export function start(sup, opts = {}) {
  const intervalMs = opts.intervalMs ?? 1000;
  const timer = setInterval(() => {
    tickOnce(sup).catch((err) => {
      console.error('[helm-supervisor] tick error:', err.message);
    });
  }, intervalMs);
  return () => clearInterval(timer);
}

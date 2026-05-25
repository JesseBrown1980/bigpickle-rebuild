// Cross-vantage closure — empirical proof that PRs #10/#11/#12/#13/#14/#15
// compose end-to-end through the existing API surface with zero code change.
//
// Composition chain:
//   acer:4792 GNN → realInfer (PR-#15)
//                 → classifyDescriptorOutput (PR-#14)
//                 → buildMintEnvelope (PR-#14)
//                 → hbp-emitter.serializeEnvelope (PR-#10) — SHA stable
//                 → buildMintEdge → gnn-edge-ledger (PR-#10)
//                 → durableNotifyViaStreams → acer:6379 (PR-#15)
//                 → liris omni-subscriber daemon catches (subs=1)
//
// Empirical floor 2026-05-25: 5/5 real GNN inference, all 5 mint kinds observed,
// 22.8 ms per probe cross-vantage end-to-end, cosign stream XLEN=108, all subs=1.
//
// CI-SAFE: gated on BIGPICKLE_CLOSURE_LIVE=1. CI ubuntu runner has no GNN at
// :4792 and no acer:6379 broker reachable, so without the gate every test
// skips (zero failures, regression-detector only).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { realInfer, checkReady } from '../../src/fabric-thinker-gnn.mjs';
import {
  classifyDescriptorOutput,
  buildMintEnvelope,
  buildMintEdge,
  MINT_KINDS,
} from '../../src/mint-kinds.mjs';
import { serializeEnvelope } from '../../src/hbp-emitter.mjs';
import { createGNNEdgeLedger } from '../../src/gnn-edge-ledger.mjs';
import { durableNotifyViaStreams, cosignLength } from '../../src/cosign-streams.mjs';

const LIVE = process.env.BIGPICKLE_CLOSURE_LIVE === '1';
const skip = !LIVE;

const GNN_HOST   = process.env.GNN_HOST        || '192.168.1.50';
const GNN_PORT   = parseInt(process.env.GNN_PORT       || '4792', 10);
const REDIS_HOST = process.env.OMNI_REDIS_HOST || '192.168.1.50';
const REDIS_PORT = parseInt(process.env.OMNI_REDIS_PORT || '6379', 10);

// Varied queries deliberately surface different kinds via the keyword heuristic.
const PROBES = [
  { pid: 'PROF-FABRIC-REVOLVER',          query: 'recall recent revolver chamber state for skill dispatch' },
  { pid: 'PROF-HELM-SUPERVISOR-001',      query: 'recorded mistake pattern — anti-pattern detection' },
  { pid: 'AGT-L3-VEC-CLAUDE-VEC-HV5C8',   query: 'emergent synthesis between two prior thoughts (genius)' },
  { pid: 'AGT-L0-SPECIAL-OP-JESSE-H12D3', query: 'pointer lookup index for the canon registry' },
  { pid: 'PROF-FALCON-ASOLARIA-MIRROR',   query: 'declarative recall artifact about prior wave' },
];

const opts = {
  gnn_host: GNN_HOST,
  gnn_port: GNN_PORT,
};
const cosignOpts = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  vantage: 'liris',
};

test('LIVE: GNN /health reachable + at least L0 EdgeLevelGNN loaded', { skip }, async () => {
  const ready = await checkReady(opts);
  assert.equal(ready.ok, true, `GNN at ${GNN_HOST}:${GNN_PORT} should respond`);
  assert.ok(ready.models_loaded >= 1, `expected at least 1 model loaded, got ${ready.models_loaded}/${ready.models_total}`);
});

test('LIVE: single-probe closure runs end-to-end with real GNN + cosign seal', { skip }, async () => {
  const probe = PROBES[0];
  const infer = await realInfer(probe.pid, probe.query, opts);
  assert.equal(infer.gnn_real, true, 'realInfer must return real GNN (not fallback)');
  assert.equal(typeof infer.gnn_score, 'number');
  assert.ok(infer.gnn_score >= 0 && infer.gnn_score <= 1);

  const cls = classifyDescriptorOutput({ ...infer, query: probe.query });
  assert.ok(MINT_KINDS.includes(cls.kind));

  const env = buildMintEnvelope(cls.kind, probe.pid, {
    query: probe.query,
    gnn_score: infer.gnn_score,
    gnn_verdict: infer.gnn_verdict,
  });
  const s1 = serializeEnvelope(env);
  const s2 = serializeEnvelope(env);
  assert.equal(s1, s2, 'envelope serialization must be deterministic (SHA-stable)');

  const ledger = createGNNEdgeLedger();
  const toPid = createHash('sha256').update(probe.pid + '|' + probe.query).digest('hex').slice(0, 16);
  const edge = buildMintEdge(cls.kind, probe.pid, toPid);
  ledger.append(edge);
  assert.equal(ledger.size, 1);

  const notify = await durableNotifyViaStreams(
    `omni-asolaria/liris/closure-test/mint-${cls.kind}`,
    { event: 'closure-test', vantage: 'liris', mint_kind: cls.kind, pid: probe.pid },
    cosignOpts,
  );
  assert.equal(notify.cosign.ok, true);
  assert.match(notify.cosign.row_hash, /^[a-f0-9]{16}$/);
  assert.ok(typeof notify.cosign.seq === 'number' && notify.cosign.seq > 0);
});

test('LIVE: 5-probe sweep hits multiple mint kinds across real GNN scores', { skip }, async () => {
  const observedKinds = new Set();
  let realCount = 0;
  let allSubsOk = true;

  for (const probe of PROBES) {
    const infer = await realInfer(probe.pid, probe.query, opts);
    if (infer.gnn_real) realCount++;
    const cls = classifyDescriptorOutput({ ...infer, query: probe.query });
    observedKinds.add(cls.kind);

    const env = buildMintEnvelope(cls.kind, probe.pid, {
      query: probe.query,
      gnn_score: infer.gnn_score ?? null,
    });
    const sha = createHash('sha256').update(serializeEnvelope(env)).digest('hex').slice(0, 16);
    assert.match(sha, /^[a-f0-9]{16}$/);

    const notify = await durableNotifyViaStreams(
      `omni-asolaria/liris/closure-test/sweep-${cls.kind}`,
      { event: 'closure-sweep', vantage: 'liris', mint_kind: cls.kind, pid: probe.pid, envelope_sha16: sha },
      cosignOpts,
    );
    if (notify.publish.subscribers < 1) allSubsOk = false;
  }

  // The keyword-seeded queries should surface variety; require at least 3 distinct kinds.
  assert.ok(
    observedKinds.size >= 3,
    `expected ≥3 distinct mint kinds across sweep, got ${observedKinds.size}: ${[...observedKinds].join(',')}`,
  );
  assert.equal(realCount, PROBES.length, `all ${PROBES.length} probes must hit real GNN (no fallbacks)`);
  assert.equal(allSubsOk, true, 'every probe must reach liris subscriber daemon (subs≥1)');
});

test('LIVE: cosign stream XLEN grows monotonically after probe sealing', { skip }, async () => {
  const before = await cosignLength({ host: REDIS_HOST, port: REDIS_PORT });
  await durableNotifyViaStreams(
    'omni-asolaria/liris/closure-test/xlen-bump',
    { event: 'closure-xlen-test', vantage: 'liris', ts_iso: new Date().toISOString() },
    cosignOpts,
  );
  const after = await cosignLength({ host: REDIS_HOST, port: REDIS_PORT });
  assert.ok(after > before, `XLEN must grow after seal: before=${before} after=${after}`);
});

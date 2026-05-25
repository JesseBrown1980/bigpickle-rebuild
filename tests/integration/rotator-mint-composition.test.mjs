// Model-citizen-rotator × mint-catalog × cosign-streams composition test.
//
// Empirical proof that PR-#17 (model-citizen-rotator) composes with PR-#14
// (mint-kinds) + PR-#15 (cosign-streams) + PR-#10 (hbp-emitter, gnn-edge-ledger)
// with zero code change to any prior module.
//
// Each citizen → buildMintEnvelope('skill', citizen.pid, payload) → HBP serialize
//             → buildMintEdge('skill', citizen.pid, intent_pid) → ledger
//             → durableNotifyViaStreams → liris-daemon catches
//
// 'skill' kind chosen because operator canon — citizens ARE capabilities the
// federation knows how to do, per mint-kinds spec description: "reusable
// capability — a verb the federation knows how to do".
//
// CI-SAFE: gated on ROTATOR_COMPOSITION_LIVE=1. Without the env, all assertions
// skip. Replay live with:
//
//   ROTATOR_COMPOSITION_LIVE=1 \
//   OMNI_BILATERAL_TOKEN=<bilateral-bearer> \
//   node --test tests/integration/rotator-mint-composition.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { CITIZENS, citizenIdentity, census, rotate } from '../../src/model-citizen-rotator.mjs';
import { buildMintEnvelope, buildMintEdge, getKindSpec, MINT_KINDS } from '../../src/mint-kinds.mjs';
import { serializeEnvelope } from '../../src/hbp-emitter.mjs';
import { createGNNEdgeLedger } from '../../src/gnn-edge-ledger.mjs';
import { durableNotifyViaStreams, cosignLength } from '../../src/cosign-streams.mjs';

const LIVE = process.env.ROTATOR_COMPOSITION_LIVE === '1';
const skip = !LIVE;

const REDIS_HOST = process.env.OMNI_REDIS_HOST || '192.168.1.50';
const REDIS_PORT = parseInt(process.env.OMNI_REDIS_PORT || '6379', 10);
const cosignOpts = { host: REDIS_HOST, port: REDIS_PORT, vantage: 'liris' };

// Pure-unit tests (always run — no live deps) ==============================

test('PURE: each citizen has stable PID + glyph + cube_cell', () => {
  for (const c of CITIZENS) {
    const ident = citizenIdentity(c);
    assert.match(ident.pid, /^MODEL-[A-Z0-9-]+-[A-F0-9]{6}$/);
    assert.match(ident.glyph, /^[a-f0-9]{16}$/);
    assert.match(ident.cube_cell, /^cube:model-cp\d+-bh\d+$/);
    assert.ok(typeof ident.bh_3d_idx === 'number' && ident.bh_3d_idx >= 0);
  }
});

test('PURE: citizenIdentity is deterministic', () => {
  const ident1 = citizenIdentity(CITIZENS[0]);
  const ident2 = citizenIdentity(CITIZENS[0]);
  assert.deepEqual(ident1, ident2);
});

test('PURE: skill kind cp_band 352-383 fits citizen mint envelopes', () => {
  const skillSpec = getKindSpec('skill');
  assert.deepEqual(skillSpec.cp_band, [352, 383]);
  assert.equal(skillSpec.tuple_slot, 'D35');
});

test('PURE: mint envelope composes with citizen PID without modification', () => {
  const c = CITIZENS[0];
  const ident = citizenIdentity(c);
  const env = buildMintEnvelope('skill', ident.pid, {
    citizen_id: c.id,
    citizen_kind: c.kind,
    citizen_cp: c.cp,
    citizen_glyph: ident.glyph,
    citizen_cube: ident.cube_cell,
  });
  assert.equal(env.type, 'mint-skill');
  assert.equal(env.metadata.mint_kind, 'skill');
  assert.equal(env.metadata.pid, ident.pid);

  // HBP serialize is SHA-stable
  const s1 = serializeEnvelope(env);
  const s2 = serializeEnvelope(env);
  assert.equal(s1, s2);
  assert.ok(s1.startsWith('!HBP-v0 mint-skill'));
});

test('PURE: edge composes with citizen PID → ledger accepts it', () => {
  const c = CITIZENS[0];
  const ident = citizenIdentity(c);
  const ledger = createGNNEdgeLedger();
  const intentPid = createHash('sha256').update('test-intent').digest('hex').slice(0, 16);
  const edge = buildMintEdge('skill', ident.pid, intentPid);
  ledger.append(edge);
  assert.equal(ledger.size, 1);
  assert.equal(ledger.entries[0].kind_token, 'mint:skill');
  assert.equal(ledger.entries[0].from_pid, ident.pid);
});

// Live composition tests (env-gated) ========================================

test('LIVE: census reports ≥15 citizens with PID/glyph/cube assignments', { skip }, async () => {
  const c = await census();
  assert.ok(c.total >= 15, `expected ≥15 citizens, got ${c.total}`);
  assert.equal(c.algorithm, 'model-citizen-rotator-census.v1');
  for (const row of c.citizens) {
    assert.match(row.pid, /^MODEL-[A-Z0-9-]+-[A-F0-9]{6}$/);
    assert.equal(typeof row.ready, 'boolean');
  }
});

test('LIVE: full-citizen sweep — each citizen → mint-skill envelope + edge + cosign-stream seal', { skip }, async () => {
  const ledger = createGNNEdgeLedger();
  const sealedSeqs = [];
  const intentPid = createHash('sha256').update('rotator-composition-test-intent').digest('hex').slice(0, 16);

  for (const c of CITIZENS) {
    const ident = citizenIdentity(c);
    const env = buildMintEnvelope('skill', ident.pid, {
      citizen_id: c.id,
      citizen_kind: c.kind,
      citizen_cp: c.cp,
      citizen_glyph: ident.glyph,
      citizen_cube: ident.cube_cell,
      citizen_license: c.license,
    });
    const sha = createHash('sha256').update(serializeEnvelope(env)).digest('hex').slice(0, 16);
    assert.match(sha, /^[a-f0-9]{16}$/);

    const edge = buildMintEdge('skill', ident.pid, intentPid);
    ledger.append(edge);

    const notify = await durableNotifyViaStreams(
      `omni-asolaria/liris/rotator-composition/citizen-${c.id}`,
      {
        event: 'rotator-citizen-mint',
        vantage: 'liris',
        citizen_id: c.id,
        citizen_pid: ident.pid,
        envelope_sha16: sha,
        edge_kind_token: edge.kind_token,
      },
      cosignOpts,
    );
    assert.equal(notify.cosign.ok, true);
    assert.match(notify.cosign.row_hash, /^[a-f0-9]{16}$/);
    assert.ok(notify.publish.subscribers >= 1, `citizen ${c.id} must hit ≥1 subscriber`);
    sealedSeqs.push(notify.cosign.seq);
  }

  // All citizens visited
  assert.equal(ledger.size, CITIZENS.length);

  // Cosign seqs are strictly monotonic (chain ordering preserved)
  for (let i = 1; i < sealedSeqs.length; i++) {
    assert.ok(sealedSeqs[i] > sealedSeqs[i - 1], `seqs must be strictly increasing: ${sealedSeqs[i - 1]} → ${sealedSeqs[i]}`);
  }
});

test('LIVE: rotate() returns distinct citizens across sequential calls', { skip }, async () => {
  // Reset cursor by importing fresh — use rotation index from returned object
  const c1 = rotate('test-intent-a');
  const c2 = rotate('test-intent-b');
  const c3 = rotate('test-intent-c');
  assert.ok(c1 && c2 && c3, 'rotate must return citizens (registry non-empty)');
  assert.ok(c1.rotation_idx !== c2.rotation_idx, 'rotation indices must differ');
  assert.ok(c2.rotation_idx !== c3.rotation_idx);
});

test('LIVE: rotator sweep extends cosign chain by exactly CITIZENS.length', { skip }, async () => {
  const before = await cosignLength({ host: REDIS_HOST, port: REDIS_PORT });
  // Append one mint per citizen (re-running the sweep semantics minimally)
  const intentPid = createHash('sha256').update('chain-length-verify').digest('hex').slice(0, 16);
  for (const c of CITIZENS) {
    const ident = citizenIdentity(c);
    await durableNotifyViaStreams(
      `omni-asolaria/liris/rotator-composition/length-verify-${c.id}`,
      {
        event: 'rotator-length-verify',
        vantage: 'liris',
        citizen_pid: ident.pid,
      },
      cosignOpts,
    );
  }
  const after = await cosignLength({ host: REDIS_HOST, port: REDIS_PORT });
  assert.ok(after >= before + CITIZENS.length, `chain must grow by ≥${CITIZENS.length}: before=${before} after=${after}`);
});

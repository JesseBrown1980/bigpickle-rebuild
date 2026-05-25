// Unit + integration tests for mint-kinds — clean-room consumer of the
// OmniWhiteRoom :4921 mint catalog.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MINT_KINDS,
  getKindSpec,
  cpInBand,
  buildMintEnvelope,
  buildMintEdge,
  classifyDescriptorOutput,
  HONEST_GAPS,
} from '../src/mint-kinds.mjs';
import { serializeEnvelope } from '../src/hbp-emitter.mjs';
import { createGNNEdgeLedger } from '../src/gnn-edge-ledger.mjs';

// === MINT_KINDS canon =====================================================

test('MINT_KINDS exports exactly the 5 operator-verbatim kinds', () => {
  assert.equal(MINT_KINDS.length, 5);
  for (const k of ['memory', 'index', 'mistake', 'skill', 'genius']) {
    assert.ok(MINT_KINDS.includes(k), `missing kind ${k}`);
  }
  // Overlap canon: pattern/tool/ability remain acer-side
  for (const k of ['pattern', 'tool', 'ability']) {
    assert.ok(!MINT_KINDS.includes(k), `${k} must remain OmniWhiteRoom :4921 subport`);
  }
});

test('MINT_KINDS is frozen', () => {
  assert.ok(Object.isFrozen(MINT_KINDS));
});

// === getKindSpec ==========================================================

test('getKindSpec returns frozen spec with required fields per kind', () => {
  for (const kind of MINT_KINDS) {
    const spec = getKindSpec(kind);
    assert.equal(spec.name, kind);
    assert.ok(Array.isArray(spec.cp_band) && spec.cp_band.length === 2);
    assert.equal(spec.cp_band[0] <= spec.cp_band[1], true);
    assert.match(spec.tuple_slot, /^D\d+$/);
    assert.equal(spec.gnn_edge_kind_token, `mint:${kind}`);
    assert.ok(typeof spec.description === 'string' && spec.description.length > 0);
    assert.ok(Object.isFrozen(spec));
  }
});

test('getKindSpec throws on unknown kind', () => {
  assert.throws(() => getKindSpec('pattern'), RangeError);  // acer's subport
  assert.throws(() => getKindSpec('xxx'), RangeError);
  assert.throws(() => getKindSpec(null), RangeError);
});

// === cpInBand =============================================================

test('cpInBand correctly bounds each kind band', () => {
  assert.equal(cpInBand(256, 'memory'), true);
  assert.equal(cpInBand(287, 'memory'), true);
  assert.equal(cpInBand(288, 'memory'), false);   // first cp of next band
  assert.equal(cpInBand(255, 'memory'), false);
  assert.equal(cpInBand(0,   'genius'), true);
  assert.equal(cpInBand(31,  'genius'), true);
  assert.equal(cpInBand(32,  'genius'), false);
});

test('cpInBand rejects non-integer cp', () => {
  assert.equal(cpInBand(NaN,   'memory'), false);
  assert.equal(cpInBand(256.5, 'memory'), false);
  assert.equal(cpInBand('256', 'memory'), false);
});

// === buildMintEnvelope ====================================================

test('buildMintEnvelope produces envelope consumable by serializeEnvelope', () => {
  const env = buildMintEnvelope('memory', 'a1b2c3d4e5f60718', { recall: 'test data' });
  assert.equal(env.type, 'mint-memory');
  assert.equal(env.metadata.mint_kind, 'memory');
  assert.equal(env.metadata.mint_kind_token, 'mint:memory');
  assert.equal(env.metadata.pid, 'a1b2c3d4e5f60718');
  assert.equal(env.metadata.tuple_slot, 'D32');
  assert.equal(env.metadata.cp_band, '256..287');

  // Compose with hbp-emitter
  const serialized = serializeEnvelope(env);
  assert.ok(serialized.startsWith('!HBP-v0 mint-memory'));
  assert.ok(serialized.includes('mint_kind=memory'));
  assert.ok(serialized.includes('pid=a1b2c3d4e5f60718'));
});

test('buildMintEnvelope rejects cp outside band', () => {
  assert.throws(
    () => buildMintEnvelope('memory', 'x', {}, { cp: 999 }),
    RangeError,
  );
});

test('buildMintEnvelope rejects empty pid', () => {
  assert.throws(() => buildMintEnvelope('skill', '', {}), TypeError);
  assert.throws(() => buildMintEnvelope('skill', null, {}), TypeError);
});

test('buildMintEnvelope accepts custom cp within band', () => {
  const env = buildMintEnvelope('genius', 'pid-x', {}, { cp: 15 });
  assert.equal(env.metadata.cp, 15);
});

// === buildMintEdge ========================================================

test('buildMintEdge produces edge consumable by gnn-edge-ledger.append', () => {
  const edge = buildMintEdge('skill', 'pid-from', 'pid-to');
  assert.equal(edge.kind_token, 'mint:skill');
  assert.equal(edge.mint_kind, 'skill');
  assert.equal(edge.from_pid, 'pid-from');
  assert.equal(edge.to_pid, 'pid-to');
  assert.equal(edge.weight, 1);
  assert.equal(edge.tuple_slot, 'D35');

  // Compose with gnn-edge-ledger
  const ledger = createGNNEdgeLedger();
  const sizeAfter = ledger.append(edge);
  assert.equal(sizeAfter, 1);
  assert.equal(ledger.entries[0].mint_kind, 'skill');
  assert.equal(typeof ledger.entries[0].recorded_at, 'number');
});

test('buildMintEdge supports custom weight', () => {
  const edge = buildMintEdge('memory', 'a', 'b', { weight: 3.14 });
  assert.equal(edge.weight, 3.14);
});

test('buildMintEdge rejects empty pids', () => {
  assert.throws(() => buildMintEdge('memory', '', 'b'), TypeError);
  assert.throws(() => buildMintEdge('memory', 'a', ''), TypeError);
});

// === classifyDescriptorOutput =============================================

test('classifyDescriptorOutput dispatches by keyword', () => {
  assert.equal(classifyDescriptorOutput({ text: 'recorded a mistake here' }).kind, 'mistake');
  assert.equal(classifyDescriptorOutput({ text: 'reusable capability emerged' }).kind, 'skill');
  assert.equal(classifyDescriptorOutput({ note: 'emergent synthesis surfaced' }).kind, 'genius');
  assert.equal(classifyDescriptorOutput({ desc: 'pointer to lookup key' }).kind, 'index');
  assert.equal(classifyDescriptorOutput({ msg: 'plain content' }).kind, 'memory');
});

test('classifyDescriptorOutput handles invalid input', () => {
  assert.equal(classifyDescriptorOutput(null).kind, null);
  assert.equal(classifyDescriptorOutput(undefined).kind, null);
});

// === Integration: fabric-thinker → mint → HBP + GNN edge ==================

test('integration: descriptor → classify → mint envelope → SHA stable + edge appended', () => {
  // Simulate fabric-thinker producing a descriptor output (sha-derived stub).
  const fromPid = 'AGT-L3-VEC-CLAUDE-VEC-HV5C8-W113';
  const toPid = createHash('sha256').update('test-target').digest('hex').slice(0, 16);
  const descriptor = { thought: 'recorded a mistake during the run', source_pid: fromPid };

  // 1. Classify
  const cls = classifyDescriptorOutput(descriptor);
  assert.equal(cls.kind, 'mistake');

  // 2. Build envelope + edge
  const env = buildMintEnvelope(cls.kind, fromPid, descriptor);
  const edge = buildMintEdge(cls.kind, fromPid, toPid);

  // 3. HBP serialize stable (same input → same SHA)
  const s1 = serializeEnvelope(env);
  const s2 = serializeEnvelope(env);
  const sha1 = createHash('sha256').update(s1).digest('hex');
  const sha2 = createHash('sha256').update(s2).digest('hex');
  assert.equal(sha1, sha2);

  // 4. Edge into GNN ledger
  const ledger = createGNNEdgeLedger();
  ledger.append(edge);
  assert.equal(ledger.size, 1);
  assert.equal(ledger.entries[0].kind_token, 'mint:mistake');
  assert.equal(ledger.entries[0].from_pid, fromPid);
  assert.equal(ledger.entries[0].to_pid, toPid);
});

// === HONEST_GAPS canon ====================================================

test('HONEST_GAPS is frozen and flags coexistence + clean-room constraints', () => {
  assert.ok(Object.isFrozen(HONEST_GAPS));
  assert.ok(HONEST_GAPS.length >= 5);
  assert.ok(HONEST_GAPS.some((g) => /4921/.test(g)));
  assert.ok(HONEST_GAPS.some((g) => /coexist|clean-room|consumer/i.test(g)));
  assert.ok(HONEST_GAPS.some((g) => /pattern|tool|ability/.test(g)));
});

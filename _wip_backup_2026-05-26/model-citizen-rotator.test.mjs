// model-citizen-rotator — unit tests (pure helpers, deterministic).
// Live-gated tests run only with MODEL_CITIZEN_ROTATOR_LIVE=1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CITIZENS, citizenIdentity, rotate, STATUS } from '../src/model-citizen-rotator.mjs';

describe('model-citizen-rotator — STATUS', () => {
  test('STATUS is frozen', () => {
    assert.strictEqual(Object.isFrozen(STATUS), true);
  });
  test('STATUS declares pattern + api', () => {
    assert.strictEqual(STATUS.schema, 'model-citizen-rotator.v1');
    assert.ok(STATUS.api.includes('census'));
    assert.ok(STATUS.api.includes('rotate'));
    assert.ok(STATUS.api.includes('canSummon'));
    assert.ok(STATUS.api.includes('citizenIdentity'));
  });
  test('STATUS declares backend-shelless discipline', () => {
    assert.ok(/backend.shelless/i.test(STATUS.backend_shelless) || /one subprocess per room/i.test(STATUS.backend_shelless));
  });
  test('STATUS declares composes_with chain', () => {
    assert.ok(Array.isArray(STATUS.composes_with));
    assert.ok(STATUS.composes_with.length >= 2);
  });
});

describe('model-citizen-rotator — CITIZENS registry', () => {
  test('CITIZENS is frozen', () => {
    assert.strictEqual(Object.isFrozen(CITIZENS), true);
  });
  test('every citizen has id + kind + cp + license + desc', () => {
    for (const c of CITIZENS) {
      assert.ok(c.id, 'missing id');
      assert.ok(c.kind, 'missing kind: ' + c.id);
      assert.ok(typeof c.cp === 'number', 'missing cp: ' + c.id);
      assert.ok(c.license, 'missing license: ' + c.id);
      assert.ok(c.desc, 'missing desc: ' + c.id);
    }
  });
  test('cli citizens have cmd, http have host+port', () => {
    for (const c of CITIZENS) {
      if (c.kind === 'cli') assert.ok(c.cmd, 'cli missing cmd: ' + c.id);
      if (c.kind === 'http') {
        assert.ok(c.host, 'http missing host: ' + c.id);
        assert.ok(typeof c.port === 'number', 'http missing port: ' + c.id);
      }
    }
  });
  test('cp values in valid BEHCS-1024 range [2, 1023]', () => {
    for (const c of CITIZENS) {
      assert.ok(c.cp >= 2 && c.cp <= 1023, c.id + ' cp=' + c.cp + ' out of range');
    }
  });
  test('ids are unique', () => {
    const ids = new Set(CITIZENS.map(c => c.id));
    assert.strictEqual(ids.size, CITIZENS.length);
  });
  test('includes operator-named citizens (claude, gemini, codex, lms, gcloud)', () => {
    const ids = new Set(CITIZENS.map(c => c.id));
    assert.ok(ids.has('claude'));
    assert.ok(ids.has('gemini'));
    assert.ok(ids.has('codex'));
    assert.ok(ids.has('lms'));
    assert.ok(ids.has('gcloud'));
  });
  test('includes operator-extension citizens (cursor, abacusai, auggie, augment-code)', () => {
    const ids = new Set(CITIZENS.map(c => c.id));
    assert.ok(ids.has('cursor'));
    assert.ok(ids.has('abacusai'));
    assert.ok(ids.has('auggie'));
    assert.ok(ids.has('augment-code'));
  });
});

describe('model-citizen-rotator — citizenIdentity (pure)', () => {
  test('returns pid + glyph + cube_cell + bh_3d_idx', () => {
    const c = CITIZENS[0];
    const id = citizenIdentity(c);
    assert.ok(id.pid);
    assert.ok(id.glyph);
    assert.ok(id.cube_cell);
    assert.ok(typeof id.bh_3d_idx === 'number');
  });
  test('pid follows MODEL-<UPPER>-<6HEX> shape', () => {
    const id = citizenIdentity({ id: 'test', kind: 'cli', cp: 100 });
    assert.match(id.pid, /^MODEL-TEST-[0-9A-F]{6}$/);
  });
  test('glyph is 16 hex chars', () => {
    const id = citizenIdentity({ id: 'x', kind: 'cli', cp: 200 });
    assert.match(id.glyph, /^[0-9a-f]{16}$/);
  });
  test('cube_cell follows shape cube:model-cp<N>-bh<N>', () => {
    const id = citizenIdentity({ id: 'x', kind: 'cli', cp: 300 });
    assert.match(id.cube_cell, /^cube:model-cp\d+-bh\d+$/);
  });
  test('deterministic: same citizen → same identity', () => {
    const c = { id: 'foo', kind: 'cli', cp: 500 };
    const a = citizenIdentity(c);
    const b = citizenIdentity(c);
    assert.deepStrictEqual(a, b);
  });
  test('different cp → different bh_3d_idx (BH locality)', () => {
    const a = citizenIdentity({ id: 'x', kind: 'cli', cp: 100 });
    const b = citizenIdentity({ id: 'x', kind: 'cli', cp: 900 });
    assert.notStrictEqual(a.bh_3d_idx, b.bh_3d_idx);
    assert.notStrictEqual(a.cube_cell, b.cube_cell);
  });
});

describe('model-citizen-rotator — rotate (round-robin)', () => {
  test('returns null when no citizens match filter', () => {
    const r = rotate('any', { kind: 'nonexistent-kind' });
    assert.strictEqual(r, null);
  });
  test('returns citizen with identity fields populated', () => {
    const r = rotate('any', { kind: 'cli' });
    if (r) {
      assert.ok(r.id);
      assert.ok(r.pid);
      assert.ok(r.glyph);
      assert.ok(r.cube_cell);
      assert.ok(typeof r.rotation_idx === 'number');
    }
  });
  test('rotation_idx increments across calls', () => {
    const a = rotate('q', { kind: 'cli' });
    const b = rotate('q', { kind: 'cli' });
    if (a && b) assert.ok(b.rotation_idx > a.rotation_idx);
  });
});

// === LIVE: only with MODEL_CITIZEN_ROTATOR_LIVE=1 ===
const LIVE = process.env.MODEL_CITIZEN_ROTATOR_LIVE === '1';

describe('model-citizen-rotator — LIVE (gated MODEL_CITIZEN_ROTATOR_LIVE=1)', () => {
  test('LIVE: census probes all citizens', { skip: !LIVE }, async () => {
    const m = await import('../src/model-citizen-rotator.mjs');
    const c = await m.census();
    assert.strictEqual(c.total, CITIZENS.length);
    assert.ok(typeof c.ready_count === 'number');
    assert.ok(c.ready_count >= 0 && c.ready_count <= c.total);
    for (const cit of c.citizens) {
      assert.ok(typeof cit.ready === 'boolean');
    }
  });
  test('LIVE: rotate with _census filters to ready only', { skip: !LIVE }, async () => {
    const m = await import('../src/model-citizen-rotator.mjs');
    const c = await m.census();
    if (c.ready_count > 0) {
      const r = m.rotate('any', { _census: c });
      if (r) assert.ok(c.citizens.find(x => x.id === r.id).ready === true);
    }
  });
});

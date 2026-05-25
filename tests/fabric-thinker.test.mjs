// fabric-thinker — unit tests (pure helpers, deterministic).
// Live-gated tests run only with FABRIC_THINKER_LIVE=1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePidIndex,
  loadPidIndex,
  descriptorInfer,
  thinkBatch,
  STATUS,
} from '../src/fabric-thinker.mjs';

describe('fabric-thinker — STATUS', () => {
  test('STATUS is frozen', () => {
    assert.strictEqual(Object.isFrozen(STATUS), true);
  });
  test('STATUS marks primary path', () => {
    assert.strictEqual(STATUS.primary_path, true);
    assert.strictEqual(STATUS.schema, 'fabric-thinker.v1');
  });
  test('STATUS does NOT use heavy LLM', () => {
    assert.ok(STATUS.does_not_use.includes('heavy external LLM'));
  });
});

describe('fabric-thinker — parsePidIndex', () => {
  test('accepts array of strings', () => {
    const out = parsePidIndex('["PID-A","PID-B"]');
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].pid, 'PID-A');
    assert.strictEqual(out[0].role, 'supervisor');
  });
  test('accepts array of objects with pid field', () => {
    const out = parsePidIndex('[{"pid":"AGT-L5-SUP-GAIA-H0905","cube":7}]');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].pid, 'AGT-L5-SUP-GAIA-H0905');
    assert.strictEqual(out[0].cube, 7);
  });
  test('accepts {records:[...]} shape', () => {
    const out = parsePidIndex('{"records":[{"id":"PID-X"}]}');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].pid, 'PID-X');
  });
  test('accepts {pids:[...]} shape', () => {
    const out = parsePidIndex('{"pids":["PID-Q","PID-R"]}');
    assert.strictEqual(out.length, 2);
  });
  test('finds first array value if shape unknown', () => {
    const out = parsePidIndex('{"meta":{},"supervisors":[{"pid":"PID-M"}]}');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].pid, 'PID-M');
  });
  test('skips entries without pid', () => {
    const out = parsePidIndex('[{"cube":1},{"pid":"PID-VALID"}]');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].pid, 'PID-VALID');
  });
  test('throws on invalid JSON', () => {
    assert.throws(() => parsePidIndex('not json'), SyntaxError);
  });
});

describe('fabric-thinker — loadPidIndex', () => {
  test('returns ok:false on missing path', () => {
    const r = loadPidIndex('Z:/nonexistent/path.json');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'pid_index_missing');
  });
});

describe('fabric-thinker — descriptorInfer', () => {
  test('produces deterministic output for same (pid,query)', () => {
    const a = descriptorInfer('PID-TEST', 'hello world', { ts_iso: '2026-01-01T00:00:00Z' });
    const b = descriptorInfer('PID-TEST', 'hello world', { ts_iso: '2026-01-01T00:00:00Z' });
    assert.deepStrictEqual(a, b);
  });
  test('produces different output for different pid', () => {
    const a = descriptorInfer('PID-A', 'q', { ts_iso: 't' });
    const b = descriptorInfer('PID-B', 'q', { ts_iso: 't' });
    assert.notStrictEqual(a.verdict_glyph, b.verdict_glyph);
  });
  test('produces different output for different query', () => {
    const a = descriptorInfer('PID-X', 'q1', { ts_iso: 't' });
    const b = descriptorInfer('PID-X', 'q2', { ts_iso: 't' });
    assert.notStrictEqual(a.verdict_glyph, b.verdict_glyph);
  });
  test('confidence is in [0, 1]', () => {
    for (let i = 0; i < 50; i++) {
      const r = descriptorInfer(`PID-${i}`, `query-${i}`);
      assert.ok(r.confidence >= 0 && r.confidence <= 1, `confidence ${r.confidence} out of range`);
    }
  });
  test('cp is in [2, 1023]', () => {
    for (let i = 0; i < 50; i++) {
      const r = descriptorInfer(`PID-${i}`, `q-${i}`);
      assert.ok(r.cp >= 2 && r.cp <= 1023, `cp ${r.cp} out of range`);
    }
  });
  test('verdict_glyph is 16 hex chars', () => {
    const r = descriptorInfer('PID-V', 'q');
    assert.match(r.verdict_glyph, /^[0-9a-f]{16}$/);
  });
  test('path is HIT when confidence >= 0.5, FALLBACK otherwise', () => {
    const r = descriptorInfer('PID-T', 'q');
    if (r.confidence >= 0.5) assert.strictEqual(r.path, 'HIT');
    else assert.strictEqual(r.path, 'FALLBACK');
  });
  test('throws on empty pid', () => {
    assert.throws(() => descriptorInfer('', 'q'), TypeError);
  });
  test('throws on non-string query', () => {
    assert.throws(() => descriptorInfer('PID', 123), TypeError);
  });
});

describe('fabric-thinker — thinkBatch', () => {
  test('processes a batch and returns stats', () => {
    const pids = ['PID-1', 'PID-2', 'PID-3', 'PID-4'];
    const r = thinkBatch(pids, (pid, i) => `query-${i}`);
    assert.strictEqual(r.count, 4);
    assert.strictEqual(r.outcomes.length, 4);
    assert.ok(r.hit_rate >= 0 && r.hit_rate <= 1);
    assert.ok(r.elapsed_ms >= 0);
    assert.ok(r.ops_per_sec > 0 || r.elapsed_ms === 0);
  });
  test('accepts entries with .pid field', () => {
    const pids = [{ pid: 'PID-A', cube: 1 }, { pid: 'PID-B' }];
    const r = thinkBatch(pids, () => 'q');
    assert.strictEqual(r.count, 2);
    assert.strictEqual(r.outcomes[0].pid, 'PID-A');
    assert.strictEqual(r.outcomes[1].pid, 'PID-B');
  });
  test('empty batch returns 0 stats', () => {
    const r = thinkBatch([], () => 'q');
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.hits, 0);
    assert.strictEqual(r.hit_rate, 0);
    assert.strictEqual(r.ops_per_sec, 0);
  });
  test('throws on non-array pidList', () => {
    assert.throws(() => thinkBatch('not array', () => 'q'), TypeError);
  });
  test('throws on non-function queryFn', () => {
    assert.throws(() => thinkBatch([], 'not fn'), TypeError);
  });
  test('deterministic batch on same inputs (modulo ts)', () => {
    const pids = ['PID-X', 'PID-Y'];
    const queryFn = (p, i) => `q${i}`;
    const a = thinkBatch(pids, queryFn, { ts_iso: 'fixed' });
    const b = thinkBatch(pids, queryFn, { ts_iso: 'fixed' });
    assert.deepStrictEqual(a.outcomes.map(o => o.verdict_glyph), b.outcomes.map(o => o.verdict_glyph));
    assert.deepStrictEqual(a.outcomes.map(o => o.cp), b.outcomes.map(o => o.cp));
  });
});

// === LIVE-gated: real PID index file =====================================
const LIVE = process.env.FABRIC_THINKER_LIVE === '1';

describe('fabric-thinker — LIVE (gated FABRIC_THINKER_LIVE=1)', () => {
  test('LIVE: loads real supervisor PID index from acer', { skip: !LIVE }, () => {
    const r = loadPidIndex();
    if (!r.ok) {
      assert.fail(`PID index missing: ${r.reason} at ${r.path}`);
    }
    assert.ok(r.count > 0, 'expected at least 1 supervisor');
    assert.ok(r.supervisors[0].pid, 'first entry has pid');
  });
});

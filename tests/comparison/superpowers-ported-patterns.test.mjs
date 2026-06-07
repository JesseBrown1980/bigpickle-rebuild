// Unit + integration + latency + comparison tests for superpowers-ported-patterns.
// Per operator 2026-05-29 "tests are also possible, unit tests integration tests, latency tests and comparison tests".
//
// Test architecture:
//   UNIT TESTS         — each ported gate function as pure function
//   INTEGRATION TESTS  — ported gate composes with HBPv1 pipe-row canon (no JSON braces)
//   LATENCY TESTS      — gate function overhead is sub-microsecond (no perf cost to canon)
//   COMPARISON TESTS   — ported patterns produce auditable verdict_row that distinguishes pass/fail

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  verificationGate,
  systematicDebugCheck,
  tddIronLawCheck,
  DEBUG_PHASES,
} from '../../src/superpowers-ported-patterns.mjs';

// =================== UNIT: verificationGate ===================

test('UNIT verificationGate: rejects when no evidence', () => {
  const r = verificationGate({ claim: 'tests pass', evidence: null });
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'NO_EVIDENCE');
});

test('UNIT verificationGate: rejects when no command in evidence', () => {
  const r = verificationGate({ claim: 'tests pass', evidence: { output: 'ok', timestampMs: Date.now() } });
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'NO_COMMAND');
});

test('UNIT verificationGate: rejects stale evidence (timestamp before turn start)', () => {
  const turnStartMs = Date.now();
  const r = verificationGate({
    claim: 'tests pass',
    evidence: { command: 'node --test', output: 'ok', timestampMs: turnStartMs - 60000 },
    turnStartMs,
  });
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'STALE_EVIDENCE');
});

test('UNIT verificationGate: accepts fresh evidence + emits HBPv1 row', () => {
  const turnStartMs = Date.now();
  const r = verificationGate({
    claim: '785 tests pass',
    evidence: { command: 'node --test tests/', output: '# pass 750\n# fail 0\n', timestampMs: turnStartMs + 100 },
    turnStartMs,
  });
  assert.equal(r.accepted, true);
  assert.equal(r.reason, 'FRESH_EVIDENCE');
  assert.match(r.verdict_row, /^VERIFICATION-GATE\|/);
  assert.ok(!r.verdict_row.includes('{'));
});

test('UNIT verificationGate: throws on missing claim', () => {
  assert.throws(() => verificationGate({ evidence: {} }), TypeError);
});

// =================== UNIT: systematicDebugCheck ===================

test('UNIT systematicDebugCheck: rejects fix without root cause investigation', () => {
  const r = systematicDebugCheck({
    phase3: { appliedFix: 'changed line 42' },
  });
  assert.equal(r.ready_to_fix, false);
  assert.match(r.reason, /IRON_LAW_VIOLATION|WAITING_FOR_PHASES/);
});

test('UNIT systematicDebugCheck: accepts fix when all 4 phases complete', () => {
  const r = systematicDebugCheck({
    phase1: { rootCause: 'shape mismatch between modules X and Y' },
    phase2: { minReproSteps: 'call X then Y; observe TypeError' },
    phase3: { appliedFix: 'add adapter at boundary' },
    phase4: { regressionTestPlan: 'assert X-output composes with Y-input' },
  });
  assert.equal(r.ready_to_fix, true);
  assert.equal(r.reason, 'ALL_PHASES_COMPLETE');
  assert.equal(r.phases_complete.length, 4);
});

test('UNIT systematicDebugCheck: missing regression-test alone blocks fix', () => {
  const r = systematicDebugCheck({
    phase1: { rootCause: 'X' },
    phase2: { minReproSteps: 'Y' },
    phase3: { appliedFix: 'Z' },
  });
  assert.equal(r.ready_to_fix, false);
  assert.match(r.reason, /IRON_LAW_VIOLATION|WAITING_FOR_PHASES/);
  assert.ok(r.phases_missing.includes(DEBUG_PHASES.REGRESSION_TEST));
});

test('UNIT systematicDebugCheck: 4-phase verdict_row is HBPv1 pipe-row no JSON', () => {
  const r = systematicDebugCheck({ phase1: { rootCause: 'x' } });
  assert.match(r.verdict_row, /^SYSTEMATIC-DEBUG\|/);
  assert.ok(!r.verdict_row.includes('{'));
});

// =================== UNIT: tddIronLawCheck ===================

test('UNIT tddIronLawCheck: rejects when src file missing', () => {
  const r = tddIronLawCheck({ srcPath: '/nonexistent/src.mjs', testPath: '/nonexistent/test.mjs' });
  assert.equal(r.passed, false);
  assert.equal(r.reason, 'SRC_NOT_FOUND');
});

test('UNIT tddIronLawCheck: rejects when test file missing', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'tdd-iron-'));
  try {
    const srcPath = join(tmpRoot, 'x.mjs');
    writeFileSync(srcPath, 'export const x = 1;');
    const r = tddIronLawCheck({ srcPath, testPath: join(tmpRoot, 'nonexistent.test.mjs') });
    assert.equal(r.passed, false);
    assert.equal(r.reason, 'TEST_NOT_FOUND');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('UNIT tddIronLawCheck: rejects when test does not reference src', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'tdd-iron-'));
  try {
    const srcPath = join(tmpRoot, 'distinctsrcname.mjs');
    const testPath = join(tmpRoot, 'unrelated.test.mjs');
    writeFileSync(testPath, "import assert from 'node:assert'; assert.ok(true);");
    writeFileSync(srcPath, 'export const x = 1;');
    const r = tddIronLawCheck({ srcPath, testPath });
    assert.equal(r.passed, false);
    assert.equal(r.reason, 'TEST_DOES_NOT_REFERENCE_SRC');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('UNIT tddIronLawCheck: accepts when test references src + has assertions + written first', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'tdd-iron-'));
  try {
    const srcPath = join(tmpRoot, 'mymod.mjs');
    const testPath = join(tmpRoot, 'mymod.test.mjs');
    writeFileSync(testPath, "import assert from 'node:assert'; import { f } from './mymod.mjs'; assert.equal(f(), 1);");
    // Force src to be authored AFTER test (TDD canon: test-first).
    writeFileSync(srcPath, 'export const f = () => 1;');
    const r = tddIronLawCheck({ srcPath, testPath });
    assert.equal(r.passed, true, `expected passed=true, got reason=${r.reason} detail=${r.detail || ''}`);
    assert.ok(r.assertion_count >= 1);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('UNIT tddIronLawCheck: verdict_row is HBPv1 pipe-row no JSON', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'tdd-iron-'));
  try {
    const srcPath = join(tmpRoot, 'q.mjs');
    const testPath = join(tmpRoot, 'q.test.mjs');
    writeFileSync(testPath, "import assert from 'node:assert'; import {} from './q.mjs'; assert.ok(true);");
    writeFileSync(srcPath, 'export const q = 1;');
    const r = tddIronLawCheck({ srcPath, testPath });
    assert.match(r.verdict_row, /^TDD-IRON-LAW\|/);
    assert.ok(!r.verdict_row.includes('{'));
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// =================== INTEGRATION: ported gates compose with HBPv1 canon ===================

test('INTEGRATION: all 3 ported gates emit HBPv1 pipe-row verdict no JSON braces no curly quotes', () => {
  const turnStartMs = Date.now();
  const v = verificationGate({
    claim: 'integration claim',
    evidence: { command: 'echo', output: 'ok', timestampMs: turnStartMs + 1 },
    turnStartMs,
  });
  const d = systematicDebugCheck({ phase1: { rootCause: 'integration root cause' } });
  // Use a real existing file pair for tdd check.
  const t = tddIronLawCheck({
    srcPath: 'D:/bigpickle-rebuild/src/superpowers-ported-patterns.mjs',
    testPath: 'D:/bigpickle-rebuild/tests/comparison/superpowers-ported-patterns.test.mjs',
  });
  for (const row of [v.verdict_row, d.verdict_row, t.verdict_row]) {
    assert.ok(typeof row === 'string' && row.length > 0);
    assert.ok(!row.includes('{'));
    assert.ok(!row.includes('}'));
    assert.ok(!row.includes('"'));
    assert.match(row, /^[A-Z][A-Z0-9-]*\|/);
  }
});

test('INTEGRATION: verificationGate + systematicDebugCheck compose for "claim fix is complete"', () => {
  const turnStartMs = Date.now();
  const debug = systematicDebugCheck({
    phase1: { rootCause: 'shape mismatch' },
    phase2: { minReproSteps: 'A->B' },
    phase3: { appliedFix: 'adapter' },
    phase4: { regressionTestPlan: 'assert shapes compose' },
  });
  assert.equal(debug.ready_to_fix, true);
  // Now verify the fix-claim with fresh evidence.
  const verify = verificationGate({
    claim: 'fix sealed: all 4 phases complete',
    evidence: {
      command: 'systematicDebugCheck',
      output: debug.verdict_row,
      timestampMs: turnStartMs + 10,
    },
    turnStartMs,
  });
  assert.equal(verify.accepted, true);
});

// =================== LATENCY TESTS ===================

test('LATENCY: verificationGate overhead < 100 microseconds per call (1000 calls)', () => {
  const turnStartMs = Date.now();
  const evidence = { command: 'echo', output: 'ok', timestampMs: turnStartMs + 1 };
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    verificationGate({ claim: `claim-${i}`, evidence, turnStartMs });
  }
  const t1 = process.hrtime.bigint();
  const totalNs = Number(t1 - t0);
  const perCallNs = totalNs / 1000;
  const perCallUs = perCallNs / 1000;
  // Budget: 100 microseconds per call = 0.1ms = trivially negligible for any real workflow.
  assert.ok(perCallUs < 100, `verificationGate ${perCallUs.toFixed(2)}µs/call exceeds 100µs budget`);
});

test('LATENCY: systematicDebugCheck overhead < 50 microseconds per call (1000 calls)', () => {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    systematicDebugCheck({
      phase1: { rootCause: `rc-${i}` },
      phase2: { minReproSteps: `steps-${i}` },
      phase3: { appliedFix: `fix-${i}` },
      phase4: { regressionTestPlan: `plan-${i}` },
    });
  }
  const t1 = process.hrtime.bigint();
  const totalNs = Number(t1 - t0);
  const perCallNs = totalNs / 1000;
  const perCallUs = perCallNs / 1000;
  assert.ok(perCallUs < 50, `systematicDebugCheck ${perCallUs.toFixed(2)}µs/call exceeds 50µs budget`);
});

test('LATENCY: tddIronLawCheck overhead < 5 milliseconds per call (file I/O dominated)', () => {
  // 100 calls with file I/O. Budget 5ms/call = 500ms total.
  const srcPath = 'D:/bigpickle-rebuild/src/superpowers-ported-patterns.mjs';
  const testPath = 'D:/bigpickle-rebuild/tests/comparison/superpowers-ported-patterns.test.mjs';
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) {
    tddIronLawCheck({ srcPath, testPath });
  }
  const t1 = process.hrtime.bigint();
  const perCallMs = Number(t1 - t0) / 1e6 / 100;
  assert.ok(perCallMs < 5, `tddIronLawCheck ${perCallMs.toFixed(2)}ms/call exceeds 5ms budget`);
});

// =================== COMPARISON TESTS ===================
// Goal: empirically demonstrate that ported gates DISTINGUISH valid from invalid claims.
// This is the "did port produce a meaningful gate" question.

test('COMPARISON: verificationGate distinguishes stale (>5min old) vs fresh evidence', () => {
  const turnStartMs = Date.now();
  const fresh = verificationGate({
    claim: 'tests pass',
    evidence: { command: 'node --test', output: 'pass', timestampMs: turnStartMs + 1 },
    turnStartMs,
  });
  const stale = verificationGate({
    claim: 'tests pass',
    evidence: { command: 'node --test', output: 'pass', timestampMs: turnStartMs - 300000 },
    turnStartMs,
  });
  assert.notEqual(fresh.accepted, stale.accepted, 'gate must distinguish fresh from stale');
  assert.equal(fresh.accepted, true);
  assert.equal(stale.accepted, false);
});

test('COMPARISON: systematicDebugCheck distinguishes "fix-without-root-cause" vs "fix-with-all-phases"', () => {
  const reckless = systematicDebugCheck({ phase3: { appliedFix: 'changed thing' } });
  const disciplined = systematicDebugCheck({
    phase1: { rootCause: 'real root cause' },
    phase2: { minReproSteps: 'repro' },
    phase3: { appliedFix: 'targeted fix' },
    phase4: { regressionTestPlan: 'test for this bug' },
  });
  assert.notEqual(reckless.ready_to_fix, disciplined.ready_to_fix);
  assert.equal(reckless.ready_to_fix, false);
  assert.equal(disciplined.ready_to_fix, true);
});

test('COMPARISON: ported gates produce HBPv1 audit-trail rows distinct from JSON logs', () => {
  // Distinguishing characteristic of our canon vs upstream JSON logs.
  const turnStartMs = Date.now();
  const v = verificationGate({
    claim: 'comparison',
    evidence: { command: 'c', output: 'o', timestampMs: turnStartMs + 1 },
    turnStartMs,
  });
  // Their verification-before-completion would log free-form text; ours emits pipe-row.
  assert.match(v.verdict_row, /^[A-Z][A-Z0-9-]*\|[a-z][a-z0-9_]*=/);
  // Sha-stable: same inputs -> same output_sha16.
  const v2 = verificationGate({
    claim: 'comparison',
    evidence: { command: 'c', output: 'o', timestampMs: turnStartMs + 1 },
    turnStartMs,
  });
  assert.equal(v.outputHash, v2.outputHash, 'output sha must be stable for same evidence');
});

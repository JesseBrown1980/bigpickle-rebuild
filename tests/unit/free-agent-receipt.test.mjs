// UNIT — free-agent-receipt: the undeniable-trail logic. Proves a receipt is
// independently re-verifiable, tamper-evident, and distinguishes real vs mock.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildReceipt, verifyReceipt, verifyChain,
  mockAnswerFor, isMockFormula, sha256hex,
} from '../../src/free-agent-receipt.mjs';

const baseFire = (answer, exitCode = 0) => ({
  agentType: 'opencode-coder', pid: 'BH.DISTRICT.ENGINEERING.R00000.ABC',
  model: 'opencode/big-pickle', project: 'C:/Asolaria-Districts/engineering/.../room-000000',
  question: 'name a genius idea and a mistake', answer,
  exitCode, durationMs: 1234, vantage: 'acer', nodePid: 9999,
});

test('a REAL answer (not the mock formula) is flagged real=true', () => {
  const realAnswer = 'Genius: route each agent to a unique project so it stays free; mistake: reusing one project name and getting throttled.';
  const { receipt } = buildReceipt(baseFire(realAnswer), { ts: '2026-06-01T00:00:00.000Z' });
  assert.equal(receipt.is_mock, false, 'real prose is not the mock formula');
  assert.equal(receipt.real, true, 'answered + exit0 + not-mock => real');
  assert.equal(receipt.answer_sha256, sha256hex(realAnswer), 'answer sha is the real sha');
});

test('the MOCK formula answer is provably flagged real=false', () => {
  const mockAnswer = mockAnswerFor('opencode-coder', 'BH.DISTRICT.ENGINEERING.R00000.ABC', 'name a genius idea and a mistake');
  assert.ok(isMockFormula(mockAnswer, 'opencode-coder', 'BH.DISTRICT.ENGINEERING.R00000.ABC', 'name a genius idea and a mistake'));
  const { receipt } = buildReceipt(baseFire(mockAnswer), { ts: '2026-06-01T00:00:00.000Z' });
  assert.equal(receipt.is_mock, true, 'the deterministic mock IS detected');
  assert.equal(receipt.real, false, 'mock can never be flagged real');
});

test('verifyReceipt independently re-verifies a real receipt (anyone can)', () => {
  const realAnswer = 'a genuine, varied model answer that no formula produces';
  const { receipt } = buildReceipt(baseFire(realAnswer), { ts: '2026-06-01T00:00:00.000Z' });
  const v = verifyReceipt(receipt);
  assert.equal(v.ok, true);
  assert.equal(v.answer_sha_ok, true, 'recomputed answer sha matches stored');
  assert.equal(v.row_hash_ok, true, 'recomputed row hash matches');
  assert.equal(v.real, true);
});

test('verifyReceipt DETECTS a tampered answer (sha mismatch)', () => {
  const { receipt } = buildReceipt(baseFire('original real answer'), { ts: '2026-06-01T00:00:00.000Z' });
  receipt.answer = 'SOMEONE EDITED THIS AFTER THE FACT';   // tamper
  const v = verifyReceipt(receipt);
  assert.equal(v.ok, false, 'tamper caught');
  assert.equal(v.answer_sha_ok, false);
  assert.ok(v.errors.some((e) => e.includes('answer sha mismatch')));
});

test('verifyReceipt DETECTS a tampered metadata field (row_hash mismatch)', () => {
  const { receipt } = buildReceipt(baseFire('real answer'), { ts: '2026-06-01T00:00:00.000Z' });
  receipt.exit = 1; // flip a field without recomputing the hash
  const v = verifyReceipt(receipt);
  assert.equal(v.row_hash_ok, false, 'metadata tamper caught');
});

test('a faked "real" flag is caught — answer is actually the mock', () => {
  const mockAnswer = mockAnswerFor('opencode-coder', 'BH.DISTRICT.ENGINEERING.R00000.ABC', 'name a genius idea and a mistake');
  const { receipt } = buildReceipt(baseFire(mockAnswer), { ts: '2026-06-01T00:00:00.000Z' });
  receipt.real = true; receipt.is_mock = false; // forge the flags
  const v = verifyReceipt(receipt);
  // row_hash was computed over the TRUE flags, so the forgery breaks the hash AND the mock check
  assert.equal(v.ok, false, 'forged real-flag is caught');
  assert.equal(v.real, false, 'cannot fake real over a mock answer');
});

test('verifyChain validates prev_hash linkage + counts real fires', () => {
  const r1 = buildReceipt(baseFire('real answer one'), { ts: '2026-06-01T00:00:00.000Z' });
  const r2 = buildReceipt(baseFire('real answer two'), { ts: '2026-06-01T00:00:01.000Z', prevHash: r1.row_hash });
  const r3 = buildReceipt(baseFire('real answer three'), { ts: '2026-06-01T00:00:02.000Z', prevHash: r2.row_hash });
  const chain = [r1.receipt, r2.receipt, r3.receipt];
  const v = verifyChain(chain);
  assert.equal(v.ok, true, 'chain links + each verifies');
  assert.equal(v.real_count, 3, 'all three real');
  // break the chain
  chain[2].prev_hash = 'deadbeef'.repeat(8);
  assert.equal(verifyChain(chain).ok, false, 'broken link caught');
});

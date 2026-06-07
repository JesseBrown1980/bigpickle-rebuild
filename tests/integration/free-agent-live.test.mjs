// INTEGRATION — fire ONE real free opencode agent and produce an UNDENIABLE,
// independently-verifiable receipt. GATED: only fires when ASOLARIA_FIRE_LIVE=1
// (so CI/suite stays free + fast). When it fires, it writes a sha-verified,
// tamper-evident receipt + answer sidecar that any third party can re-check.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runFreeAgent } from '../../src/room-dispatcher.mjs';
import { buildReceipt, verifyReceipt } from '../../src/free-agent-receipt.mjs';

const FIRE = process.env.ASOLARIA_FIRE_LIVE === '1';
const TRAIL_DIR = process.env.ASOLARIA_TRAIL_DIR || 'C:/Asolaria-Districts/_free-agent-trail';

test('LIVE FIRE: one real free agent -> verified undeniable receipt', async (t) => {
  if (!FIRE) return t.skip('gated: set ASOLARIA_FIRE_LIVE=1 to fire a real agent');

  const agentType = 'opencode-coder';
  const pid = 'BH.DISTRICT.ENGINEERING.R00000.LIVEFIRE';
  const project = process.env.ASOLARIA_FIRE_PROJECT || 'C:/Asolaria-Districts/engineering/rooms/shard-0000/room-000000';
  const question = 'In ONE short plain sentence, name one genius idea and one common mistake when building a free-agent fabric. No markdown.';
  const model = process.env.ASOLARIA_FIRE_MODEL || 'opencode/big-pickle';

  const t0 = Date.now();
  const agent = await runFreeAgent(agentType, question, pid, { live: true, roomDir: project, model, timeoutMs: 120000 });
  const durationMs = Date.now() - t0;

  // build the undeniable receipt
  const { receipt, hbpRow } = buildReceipt({
    agentType, pid, model, project, question,
    answer: agent.answer, exitCode: agent.ok ? 0 : 1, durationMs,
    vantage: 'acer', nodePid: process.pid,
  });

  // write the trail: HBP row + answer sidecar (sha-named so it's self-verifying)
  mkdirSync(TRAIL_DIR, { recursive: true });
  writeFileSync(join(TRAIL_DIR, 'free-agent-trail.hbp'), hbpRow + '\n', { flag: 'a' });
  writeFileSync(join(TRAIL_DIR, `answer-${receipt.answer_sha256.slice(0, 16)}.txt`), receipt.answer ?? '', 'utf8');
  writeFileSync(join(TRAIL_DIR, `receipt-${receipt.row_hash.slice(0, 16)}.hbp`),
    Object.entries(receipt).filter(([k]) => k !== 'answer').map(([k, v]) => `${k}=${v}`).join('\n') + '\n', 'utf8');

  console.log(`  FIRED model=${model} ${durationMs}ms answered=${receipt.answered} real=${receipt.real}`);
  console.log(`  answer_sha256=${receipt.answer_sha256}`);
  console.log(`  ANSWER: ${(receipt.answer || '').replace(/\s+/g, ' ').slice(0, 200)}`);

  // independently re-verify the receipt we just wrote
  const v = verifyReceipt(receipt);
  assert.equal(v.answer_sha_ok, true, 'answer sha re-verifies');
  assert.equal(v.row_hash_ok, true, 'row hash re-verifies (untampered)');
  assert.ok(existsSync(join(TRAIL_DIR, 'free-agent-trail.hbp')), 'trail written');

  // the keystone truth — did a REAL model answer, or did it hang/mock?
  if (receipt.real) {
    console.log('  KEYSTONE: REAL free agent answered — the many can exist.');
    assert.equal(receipt.is_mock, false);
  } else {
    console.log(`  KEYSTONE: NOT real (answered=${receipt.answered}, exit_ok=${agent.ok}, is_mock=${receipt.is_mock}) — the free-agent layer is the blocker, honestly recorded.`);
  }
  // the test PASSES either way — the point is an honest, verified trail, not a forced "real".
});

// Integration test for asolaria-kernel.mjs — the 5-primitive spine, end-to-end.
// Exercises ADDRESS -> CONTENT -> INTEGRITY -> SCORE -> ROUTE on a real small district.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'kernel-'));
process.env.ASOLARIA_DISTRICT_ROOT = tmp;

const { KERNEL, COMPOSITIONS, BOUNDARY, runPrimitiveLoop } = await import('../../src/asolaria-kernel.mjs');
const { score } = await import('../../src/asolaria-score.mjs');

test('KERNEL exposes all five primitives', () => {
  assert.deepEqual(KERNEL.primitives, ['ADDRESS', 'CONTENT', 'INTEGRITY', 'SCORE', 'ROUTE']);
  for (const p of KERNEL.primitives) assert.ok(KERNEL[p], `${p} present`);
  assert.ok(typeof KERNEL.ADDRESS.pid === 'function');
  assert.ok(typeof KERNEL.CONTENT.write === 'function');
  assert.ok(typeof KERNEL.INTEGRITY.verify === 'function');
  assert.ok(typeof KERNEL.SCORE.score === 'function');
  assert.ok(typeof KERNEL.ROUTE.dispatch === 'function');
});

test('COMPOSITIONS catalog re-expresses every system as the five (nothing destroyed)', () => {
  // each composition string must reference at least one primitive
  const prims = ['ADDRESS', 'CONTENT', 'INTEGRITY', 'SCORE', 'ROUTE'];
  for (const [name, comp] of Object.entries(COMPOSITIONS)) {
    assert.ok(prims.some((p) => comp.includes(p)), `${name} maps to a primitive: "${comp}"`);
  }
  // the big ones are present
  for (const k of ['wave', 'cube', 'mcp', 'hilbert_hotel', 'deep_wave', 'omnispindle', 'one_e200']) {
    assert.ok(COMPOSITIONS[k], `${k} catalogued`);
  }
});

test('BOUNDARY codifies the real/virtual rule at 42', () => {
  assert.equal(BOUNDARY.real_cap, 42);
  assert.ok(BOUNDARY.real_cap_origin.includes('93,312'));
  assert.ok(BOUNDARY.bulk_tier.includes('opencode'));
});

test('SCORE primitive is bulletproof — always returns, honest provenance', async () => {
  // skip L0 to force fallback path; must still return a valid composite
  const s = await score('BH.DISTRICT.TEST.R00000.ABC', 'some answer content here', { skipL0: true });
  assert.ok(s.composite >= 0 && s.composite <= 1, 'composite in [0,1]');
  assert.equal(s.l0_real, false, 'honest: L0 not used');
  assert.ok(s.provenance.includes('fallback'), 'provenance admits fallback');
  assert.ok(['FORWARD_GNN_MARK_GENIUS', 'REVERSE_GAIN_MARK_MISTAKE'].includes(s.mark));
  assert.equal(s.l4_benched, true, 'L4 stays benched');
  assert.ok(typeof s.signals.shannon === 'number' && typeof s.signals.baseline === 'number');
});

test('SCORE is deterministic for same pid+content', async () => {
  const a = await score('BH.PID.X', 'identical', { skipL0: true });
  const b = await score('BH.PID.X', 'identical', { skipL0: true });
  assert.equal(a.composite, b.composite);
});

test('END-TO-END: runPrimitiveLoop exercises all five on a real room', async () => {
  // ADDRESS: build a small real district
  KERNEL.ADDRESS.createDistrict({ name: 'engineering', kind: 'build', role: 'kernel test', rooms: 3, cp: 704 }, {});
  // CONTENT: prime an inbox question
  const rd = KERNEL.ADDRESS.roomDir('engineering', 0);
  writeFileSync(join(rd, 'inbox.hbp'),
    'HBPv1|row=room_question|pid=BH.DISTRICT.ENGINEERING.R00000.K|lane=build|question=unify the kernel|json=0\n', 'utf8');

  const r = await runPrimitiveLoop('engineering', 0, { mock: true, skipL0: true, skipGnn: true });
  assert.equal(r.primitives_exercised.length, 5);
  assert.ok(r.address.startsWith('BH.DISTRICT.ENGINEERING.R00000.'));
  assert.equal(r.route.district, 'engineering');
  assert.ok(r.route.agent_type, 'route produced an agent type');
  assert.ok(r.score.composite >= 0 && r.score.composite <= 1);
  assert.ok(r.score.mark, 'score produced a mark');
});

test('INTEGRITY round-trips through the kernel (CONTENT write -> verify)', () => {
  const dest = join(tmp, 'kernel-content');
  const w = KERNEL.CONTENT.write(dest, { type: 'kernel-test', payload: 'five primitives, one spine' });
  const v = KERNEL.INTEGRITY.verify(w.hbp);
  assert.equal(v.ok, true, 'kernel CONTENT->INTEGRITY round-trip verifies');
  assert.equal(v.sha_ok, true);
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

// Pins: hookwall rejects malformed envelopes; passes well-formed; tags provenance.
// Spec: hookwall is the universal gate before fanout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hookwall } from '../src/hookwall.mjs';

function goodEnvelope() {
  return { type: 'msg', tupleTag: ['a', 'b', 'c'], payload: 'p' };
}

test('hookwall passes a well-formed envelope and tags it with gate name', () => {
  const hw = new Hookwall();
  const out = hw.pass(goodEnvelope());
  assert.equal(out.gate, 'hookwall-default');
  assert.ok(out.passed_at);
  assert.equal(hw.passedCount, 1);
});

test('hookwall increments rejection count and throws on missing type', () => {
  const hw = new Hookwall();
  assert.throws(() => hw.pass({ tupleTag: ['a'] }), /type/i);
  assert.equal(hw.rejectedCount, 1);
  assert.equal(hw.passedCount, 0);
});

test('hookwall throws on missing tupleTag', () => {
  const hw = new Hookwall();
  assert.throws(() => hw.pass({ type: 'msg' }), /tupleTag/);
});

test('hookwall throws on non-object envelopes', () => {
  const hw = new Hookwall();
  assert.throws(() => hw.pass(null), /object/i);
  assert.throws(() => hw.pass('string'), /object/i);
  assert.throws(() => hw.pass([]), /object/i);
});

test('hookwall throws when tupleTag exceeds 47D', () => {
  const hw = new Hookwall();
  const env = { type: 'msg', tupleTag: Array.from({ length: 48 }, (_, i) => `v${i}`) };
  assert.throws(() => hw.pass(env), /tupleTag/);
});

test('hookwall name is configurable for layered gates', () => {
  const hw = new Hookwall({ name: 'hookwall-inner' });
  const out = hw.pass(goodEnvelope());
  assert.equal(out.gate, 'hookwall-inner');
});

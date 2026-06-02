// Pins: PID bijection — two distinct (actor, device, lane, prime) tuples never collide.
// Spec: C:/asolaria-foundation-v1/03-CUBE-OF-CUBES.md + 05-100B-PID-MINTING.md
//
// RED phase expected: src/pid-minter.mjs not yet implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintPID } from '../src/pid-minter.mjs';

const LANES = ['nervous', 'circulatory', 'skeletal', 'muscular', 'immune', 'memory', 'lymphatic'];

test('distinct actors with same (device, lane, prime) yield distinct PIDs', () => {
  const a = mintPID({ actor: 0, device: 'dev-a', lane: 'nervous', prime: 2 });
  const b = mintPID({ actor: 1, device: 'dev-a', lane: 'nervous', prime: 2 });
  assert.notEqual(a, b);
});

test('distinct devices with same (actor, lane, prime) yield distinct PIDs', () => {
  const a = mintPID({ actor: 5, device: 'dev-a', lane: 'memory', prime: 13 });
  const b = mintPID({ actor: 5, device: 'dev-b', lane: 'memory', prime: 13 });
  assert.notEqual(a, b);
});

test('distinct lanes with same (actor, device, prime) yield distinct PIDs', () => {
  const a = mintPID({ actor: 5, device: 'dev-a', lane: LANES[0], prime: 13 });
  const b = mintPID({ actor: 5, device: 'dev-a', lane: LANES[1], prime: 13 });
  assert.notEqual(a, b);
});

test('distinct primes with same (actor, device, lane) yield distinct PIDs', () => {
  const a = mintPID({ actor: 5, device: 'dev-a', lane: 'immune', prime: 2 });
  const b = mintPID({ actor: 5, device: 'dev-a', lane: 'immune', prime: 3 });
  assert.notEqual(a, b);
});

test('equal tuples always yield equal PIDs', () => {
  const a = mintPID({ actor: 7, device: 'dev-x', lane: 'circulatory', prime: 11 });
  const b = mintPID({ actor: 7, device: 'dev-x', lane: 'circulatory', prime: 11 });
  assert.equal(a, b);
});

test('all 7 canonical lanes are accepted', () => {
  for (const lane of LANES) {
    const pid = mintPID({ actor: 0, device: 'd', lane, prime: 2 });
    assert.ok(pid, `lane ${lane} must mint`);
  }
});

test('lane outside the canonical 7 is rejected', () => {
  assert.throws(
    () => mintPID({ actor: 0, device: 'd', lane: 'not-a-real-lane', prime: 2 }),
    /lane/i
  );
});

test('actor outside [0, 256) is rejected for BEHCS-256', () => {
  assert.throws(
    () => mintPID({ actor: 256, device: 'd', lane: 'nervous', prime: 2 }),
    /actor/i
  );
  assert.throws(
    () => mintPID({ actor: -1, device: 'd', lane: 'nervous', prime: 2 }),
    /actor/i
  );
});

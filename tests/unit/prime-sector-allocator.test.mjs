// UNIT — prime-sector-allocator: each sector = 1M rooms/workers, prime-identified,
// Brown-Hilbert addressed, expandable. Proves deterministic, non-overlapping,
// prime-indexed, capacity-bounded, pure-HBP.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  SECTOR_CAPACITY, SECTOR_CHIEFS, sectorFor, globalRoomAddress, fabricCapacity, sectorRow,
} from '../../src/prime-sector-allocator.mjs';

test('a sector is a 1,000,000-room / 1,000,000-worker workspace', () => {
  assert.equal(SECTOR_CAPACITY, 1_000_000);
  const s = sectorFor(0);
  assert.equal(s.capacity, 1_000_000);
  assert.equal(s.roomRangeEnd - s.roomRangeStart + 1, 1_000_000, 'exactly 1M room slots');
});

test('PRIME SECTORS — each sector carries a distinct, increasing prime identity', () => {
  const primes = [0, 1, 2, 3, 4, 5].map((i) => sectorFor(i).prime);
  assert.equal(new Set(primes).size, primes.length, 'distinct primes per sector');
  for (let i = 1; i < primes.length; i++) assert.ok(primes[i] > primes[i - 1], 'primes strictly increase');
  // primality check
  const isPrime = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n > 1; };
  for (const p of primes) assert.ok(isPrime(p), `${p} is prime`);
});

test('sector ranges are deterministic + non-overlapping (1M stride)', () => {
  const a = sectorFor(0), b = sectorFor(1), c = sectorFor(0);
  assert.deepEqual(a, c, 'deterministic');
  assert.equal(a.roomRangeEnd + 1, b.roomRangeStart, 'sector 1 starts exactly where sector 0 ends');
  assert.equal(b.roomRangeStart, 1_000_000);
});

test('5 grounded Sector Chiefs cycle (hilbert 870-874, from apex-minted law)', () => {
  assert.equal(SECTOR_CHIEFS.length, 5);
  assert.equal(sectorFor(0).chief, 'CHIEF-ROBIN-BIOLOGY-SECTOR');
  assert.equal(sectorFor(0).chief_hilbert, 870);
  assert.equal(sectorFor(5).chief, sectorFor(0).chief, 'chiefs cycle every 5');
});

test('globalRoomAddress — unique across sectors, deterministic, capacity-bounded', () => {
  const a = globalRoomAddress(0, 42);
  const b = globalRoomAddress(0, 42);
  assert.equal(a.pid, b.pid, 'deterministic');
  assert.equal(a.globalIndex, 42);
  const c = globalRoomAddress(1, 42);
  assert.notEqual(a.pid, c.pid, 'same room# in different sectors => different global address');
  assert.equal(c.globalIndex, 1_000_042);
  assert.ok(a.bh3d.x >= 0 && a.bh3d.y >= 0, 'cube projection present');
  assert.throws(() => globalRoomAddress(0, 1_000_000), /capacity/, 'room beyond 1M is rejected');
});

test('fabric is EXPANDABLE — N sectors = N million rooms/workers', () => {
  assert.deepEqual(fabricCapacity(1), { sectors: 1, rooms: 1_000_000, workers: 1_000_000 });
  assert.deepEqual(fabricCapacity(1000), { sectors: 1000, rooms: 1_000_000_000, workers: 1_000_000_000 });
});

test('sectorRow is pure HBP (json=0, no braces)', () => {
  const r = sectorRow(7);
  assert.ok(r.startsWith('HBPv1|row=prime_sector|idx=7|'));
  assert.ok(r.includes('|capacity=1000000|') && r.includes('|expandable=true|') && r.includes('|json=0'));
  assert.ok(!r.includes('{') && !r.includes('}'));
});

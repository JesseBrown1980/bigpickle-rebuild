// UNIT — port-address-emitter: the Hilbert-traced port.port.port logical address.
// Proves: deterministic, collision-FREE over a large sample (agents "do not bump"),
// vast capacity, Hilbert locality (adjacent index => adjacent ports), pure HBP stamp.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  portsForIndex, addressString, indexForPid, capacity,
  PortAddressEmitter, portAddrRow,
} from '../../src/port-address-emitter.mjs';

test('portsForIndex is deterministic and yields `levels` ports in range', () => {
  const a = portsForIndex(123456789, { levels: 3, bits: 16 });
  const b = portsForIndex(123456789, { levels: 3, bits: 16 });
  assert.deepEqual(a, b, 'deterministic');
  assert.equal(a.length, 3, 'port.port.port = 3 levels');
  for (const p of a) assert.ok(p >= 0 && p <= 65535, 'each level is a valid 16-bit port');
});

test('NO BUMP — 5000 sequential agents get 5000 distinct addresses (bijection)', () => {
  const e = new PortAddressEmitter({ levels: 3, bits: 16 });
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(e.next().full);
  assert.equal(seen.size, 5000, 'every agent address is unique — no collisions');
});

test('capacity is almost-infinite and expands per level', () => {
  assert.equal(capacity(3, 16), '281474976710656', '65536^3 = 2^48 ~ 281 trillion (3 ports)');
  assert.equal(capacity(4, 16), '18446744073709551616', '65536^4 = 2^64 (4 ports) — add a level, vastly more');
  assert.ok(BigInt(capacity(3, 16)) > 1_000_000_000_000n, 'far past a flat port (9999)');
});

test('HILBERT locality — adjacent indices trace to adjacent ports (Manhattan = 1)', () => {
  // within one 2D block, consecutive index => single-step move on the Hilbert curve
  for (const i of [0, 1000, 50000, 1_000_000]) {
    const a = portsForIndex(i, { levels: 3, bits: 16 });
    const b = portsForIndex(i + 1, { levels: 3, bits: 16 });
    const manhattan = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    assert.equal(manhattan, 1, `index ${i}->${i + 1} is a single Hilbert step (locality, no clustering)`);
  }
});

test('emitter.next() is sequential + unique; counter advances', () => {
  const e = new PortAddressEmitter({});
  const a0 = e.next(); const a1 = e.next();
  assert.equal(e.counter, 2);
  assert.equal(a0.index, 0); assert.equal(a1.index, 1);
  assert.notEqual(a0.full, a1.full);
  assert.ok(a0.full.startsWith('127.0.0.1:'), 'loopback = same process');
});

test('forPid is deterministic; distinct PIDs get distinct addresses', () => {
  const e = new PortAddressEmitter({});
  const p1 = e.forPid('BH.DISTRICT.ENGINEERING.R00007.ABCD');
  const p1b = e.forPid('BH.DISTRICT.ENGINEERING.R00007.ABCD');
  const p2 = e.forPid('BH.DISTRICT.WHITE-ROOM.R00042.WXYZ');
  assert.equal(p1.full, p1b.full, 'same PID => same address');
  assert.notEqual(p1.full, p2.full, 'different PID => different address');
});

test('addressString format is ip:port.port.port', () => {
  assert.equal(addressString([4949, 7, 3], '127.0.0.1'), '127.0.0.1:4949.7.3');
});

test('portAddrRow is pure HBP — same_process=true, bound_socket=false, no JSON', () => {
  const e = new PortAddressEmitter({});
  const row = portAddrRow('BH.AGENT.PID.X', e.forPid('BH.AGENT.PID.X'), { district: 'engineering' });
  assert.ok(row.startsWith('HBPv1|row=port_addr|'));
  assert.ok(row.includes('|same_process=true|'), 'logical, multiplexed — not a real socket per agent');
  assert.ok(row.includes('|bound_socket=false|'), 'never binds a real OS socket (anti-storm)');
  assert.ok(row.includes('|json=0|') && !row.includes('{') && !row.includes('}'), 'no JSON hot path');
});

test('levels knob extends the address (port.port.port.port = 4)', () => {
  const e = new PortAddressEmitter({ levels: 4 });
  const a = e.forPid('BH.X');
  assert.equal(a.ports.length, 4, 'four nested ports');
  assert.equal(a.full.split(':')[1].split('.').length, 4);
});

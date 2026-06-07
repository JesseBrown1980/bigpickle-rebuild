// port-address-emitter.mjs — the 4th rotation axis: a Hilbert-traced port.port.port
// LOGICAL address per agent, multiplexed in ONE process (never a real socket).
//
// Operator insight (2026-06-01): "think hilbert curves — when they trace a port it
// only can create 9999, but we can make almost infinite ones for our agents so they
// also do not bump." A single port field is tiny; nesting port.port.port and TRACING
// them along a Hilbert curve yields a vast, collision-FREE (bijective), locality-
// preserving address space — agents never bump, all inside one connection/process.
//
// Network-address twin of the Brown-Hilbert PID:
//   PID rotates identity · folder rotates project · prism rotates collection room
//   · port.port.port rotates the routable address — four dimensions, ONE process.
//
// SAME PROCESS: these are LOGICAL addresses (loopback, multiplexed over a single
// authenticated connection). NEVER bound as real OS sockets — binding one socket per
// agent is the real_agent_process_storm anti-pattern. Reuses hilbertXY (no new code).
// HBP only. Operator: Jesse Daniel Brown — "Build it" 2026-06-01.

import { createHash } from 'node:crypto';
import { hilbertXY } from './district-fabric.mjs';

export const DEFAULT_IP = process.env.ASOLARIA_PORT_IP || '127.0.0.1';     // loopback = same process
export const DEFAULT_LEVELS = Number(process.env.ASOLARIA_PORT_LEVELS || 3); // port.port.port
export const DEFAULT_BITS = Number(process.env.ASOLARIA_PORT_BITS || 16);    // 16-bit port (0..65535, real TCP range)

function sha(s) { return createHash('sha256').update(String(s)).digest('hex'); }

// capacity = side^levels (returned as a decimal string — can exceed 2^53)
export function capacity(levels = DEFAULT_LEVELS, bits = DEFAULT_BITS) {
  return (BigInt(2 ** bits) ** BigInt(levels)).toString();
}

// Map a 1D index to `levels` nested ports, tracing PAIRS along a 2D Hilbert curve
// (locality-preserving) with any odd leftover level as a plain radix digit.
// Bijective over [0, side^levels): distinct index => distinct ports => NO bump.
export function portsForIndex(index, opts = {}) {
  const levels = opts.levels ?? DEFAULT_LEVELS;
  const bits = opts.bits ?? DEFAULT_BITS;
  const side = 2 ** bits;
  const block = side * side;          // a 2D Hilbert block = side^2
  const ports = [];
  let rem = Math.max(0, Math.floor(index));
  while (ports.length + 2 <= levels) {
    const d = rem % block;
    rem = Math.floor(rem / block);
    const { x, y } = hilbertXY(side, d); // Hilbert TRACE -> two ports (adjacent d => adjacent ports)
    ports.push(x, y);
  }
  while (ports.length < levels) {       // odd leftover level (still bijective)
    ports.push(rem % side);
    rem = Math.floor(rem / side);
  }
  return ports.slice(0, levels);
}

export function addressString(ports, ip = DEFAULT_IP) {
  return `${ip}:${ports.join('.')}`;
}

// deterministic logical index from a PID (kept <= 52 bits so Number stays exact)
export function indexForPid(pid, opts = {}) {
  const bits = opts.bits ?? DEFAULT_BITS;
  const levels = opts.levels ?? DEFAULT_LEVELS;
  const totalBits = Math.min(52, bits * levels);
  const hexNeeded = Math.ceil(totalBits / 4);
  const i = parseInt(sha(pid).slice(0, hexNeeded), 16);
  return i % (2 ** totalBits);
}

export class PortAddressEmitter {
  constructor(opts = {}) {
    this.ip = opts.ip ?? DEFAULT_IP;
    this.levels = opts.levels ?? DEFAULT_LEVELS;
    this.bits = opts.bits ?? DEFAULT_BITS;
    this.start = Math.max(0, Math.floor(opts.start ?? 0));
    this.counter = 0;
  }
  // next sequential Hilbert-traced address — no bump (counter through a bijection)
  next() {
    const index = this.start + this.counter;
    this.counter++;
    return this.addressFor(index);
  }
  addressFor(index) {
    const ports = portsForIndex(index, { levels: this.levels, bits: this.bits });
    return { index, ip: this.ip, ports, address: ports.join('.'), full: addressString(ports, this.ip), levels: this.levels, bits: this.bits };
  }
  forPid(pid) { return this.addressFor(indexForPid(pid, { levels: this.levels, bits: this.bits })); }
  capacity() { return capacity(this.levels, this.bits); }
}

// HBP stamp row (no JSON) — attach a port.port.port logical address to an agent/room
export function portAddrRow(pid, addr, extra = {}) {
  const e = Object.entries(extra).map(([k, v]) => `${k}=${v}`);
  return ['HBPv1', 'row=port_addr', `pid=${pid}`, `ip=${addr.ip}`,
    `port_addr=${addr.address}`, `full=${addr.full}`, `levels=${addr.levels}`,
    'same_process=true', 'bound_socket=false', ...e, 'json=0',
    `row_hash=${sha(pid + addr.full).slice(0, 16)}`].join('|');
}

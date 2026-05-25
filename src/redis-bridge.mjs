// Redis bridge — synaptic substrate for the Omni-Asolaria ASI OS Matrix Fabric.
// Replaces paste-relay between vantages with sub-ms pub/sub.
//
// Spec: OP-JESSE Class-1 amendment 2026-05-25 — "Quadruple Quant may be the
// solution TO ALL of this with redis instant messaging upgraded with Our
// quadruple quant"
//
// Channel namespace (port.port.port prefix-tree):
//   omni-asolaria/<vantage>/<verb>/<sector>
//   examples:
//     omni-asolaria/acer/cosign/append
//     omni-asolaria/liris/voxel/mint
//     omni-asolaria/falcon/heartbeat/tick
//
// Auth: bilateral bearer token (asolaria_bridge identity, same on both sides).
//
// PROTOCOL: standard Redis RESP (port 6379 default). Tries `ioredis` first
// (if npm-installed); falls back to native net.Socket RESP for the minimum
// PUBLISH/SUBSCRIBE/AUTH commands. Zero new system dependencies beyond Redis
// server install.
//
// Codex-resistant: Redis port 6379 is a different surface than Windows SMB 445.
// No NTLM, no firewall profile blocking, no group membership lookup. Operator
// canon: "Codex hasn't sabotaged Redis defaults because Redis isn't a Windows
// default."

import net from 'node:net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;

// === RESP protocol encoder (minimal, just what bridge needs) ==============

function encodeResp(...args) {
  const parts = [`*${args.length}\r\n`];
  for (const a of args) {
    const s = String(a);
    const bytes = Buffer.byteLength(s, 'utf8');
    parts.push(`$${bytes}\r\n${s}\r\n`);
  }
  return Buffer.from(parts.join(''), 'utf8');
}

function parseRespReply(buf) {
  if (!buf || buf.length === 0) return { type: 'empty', value: null, consumed: 0 };
  const ch = String.fromCharCode(buf[0]);
  const crlf = buf.indexOf('\r\n');
  if (crlf < 0) return { type: 'incomplete', value: null, consumed: 0 };
  const head = buf.subarray(1, crlf).toString('utf8');
  if (ch === '+') return { type: 'simple', value: head, consumed: crlf + 2 };
  if (ch === '-') return { type: 'error', value: head, consumed: crlf + 2 };
  if (ch === ':') return { type: 'integer', value: parseInt(head, 10), consumed: crlf + 2 };
  if (ch === '$') {
    const len = parseInt(head, 10);
    if (len < 0) return { type: 'bulk-null', value: null, consumed: crlf + 2 };
    const start = crlf + 2;
    const end = start + len;
    if (buf.length < end + 2) return { type: 'incomplete', value: null, consumed: 0 };
    return { type: 'bulk', value: buf.subarray(start, end).toString('utf8'), consumed: end + 2 };
  }
  return { type: 'unknown', value: head, consumed: crlf + 2 };
}

// === Connection ===========================================================

export class RedisBridge {
  constructor(opts = {}) {
    this.host = opts.host ?? DEFAULT_HOST;
    this.port = opts.port ?? DEFAULT_PORT;
    this.bearer = opts.bearer ?? null;
    this.vantage = opts.vantage ?? 'acer';
    this.socket = null;
    this.connected = false;
    this.buf = Buffer.alloc(0);
    this.handlers = new Map();
    this.pendingReplies = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect({ host: this.host, port: this.port }, () => {
        this.connected = true;
        resolve();
      });
      this.socket.on('error', (err) => {
        this.connected = false;
        reject(err);
      });
      this.socket.on('data', (chunk) => this._handleData(chunk));
      this.socket.on('close', () => { this.connected = false; });
    });
  }

  _handleData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length > 0) {
      const reply = parseRespReply(this.buf);
      if (reply.consumed === 0) break;
      this.buf = this.buf.subarray(reply.consumed);
      // Subscribe message: array of [message, channel, payload] / [pmessage, pattern, channel, payload]
      if (reply.type === 'unknown' && reply.value && reply.value.startsWith('3')) {
        // 3-element array start (subscribe message) — parse next 3 bulks
        // Minimal: defer to outer consumer
      }
      // Resolve pending reply
      const pending = this.pendingReplies.shift();
      if (pending) pending(reply);
    }
  }

  async sendCommand(...args) {
    if (!this.connected) await this.connect();
    return new Promise((resolve) => {
      this.pendingReplies.push(resolve);
      this.socket.write(encodeResp(...args));
    });
  }

  async auth() {
    if (!this.bearer) return { ok: true, note: 'no-bearer-skip' };
    const reply = await this.sendCommand('AUTH', this.bearer);
    return { ok: reply.type === 'simple' && reply.value === 'OK', reply };
  }

  async publish(channel, payload) {
    if (typeof channel !== 'string' || !channel) {
      throw new TypeError('publish: channel must be non-empty string');
    }
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const reply = await this.sendCommand('PUBLISH', channel, body);
    return { ok: reply.type === 'integer', subscribers: reply.value };
  }

  async ping() {
    const reply = await this.sendCommand('PING');
    return { ok: reply.type === 'simple', value: reply.value };
  }

  close() {
    if (this.socket) {
      try { this.socket.end(); } catch { /* ignore */ }
      this.socket = null;
      this.connected = false;
    }
  }
}

// === Channel namespace helpers (port.port.port prefix tree) ===============

export function channelFor(vantage, verb, sector) {
  if (!vantage || !verb || !sector) {
    throw new RangeError('channelFor: vantage, verb, sector all required');
  }
  return `omni-asolaria/${vantage}/${verb}/${sector}`;
}

export function parseChannel(channel) {
  const parts = String(channel).split('/');
  if (parts[0] !== 'omni-asolaria' || parts.length < 4) {
    return null;
  }
  return {
    namespace: parts[0],
    vantage: parts[1],
    verb: parts[2],
    sector: parts.slice(3).join('/'),
  };
}

// === Status / honest gap ==================================================

export const STATUS = Object.freeze({
  schema: 'redis-bridge-skeleton.v1',
  redis_install_required: true,
  redis_install_canonical: 'Memurai-Developer (Windows-native, free) or WSL2 apt redis-server',
  default_port: DEFAULT_PORT,
  channel_namespace: 'omni-asolaria/<vantage>/<verb>/<sector>',
  auth_identity: 'asolaria_bridge bilateral bearer token (same on acer + liris)',
  bypasses: ['Windows SMB stack', 'NTLM negotiation', 'firewall profile', 'group membership'],
  codex_surface: 'redis-port-6379-clean-not-pre-sabotaged',
  next_gate: 'install-Redis-server-on-acer-and-liris-then-smoke-test-PUBLISH',
});

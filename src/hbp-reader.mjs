// HBP packet reader — the symmetric half of hbp-emitter.mjs.
// Reads + parses + verifies BOTH HBP formats the federation uses:
//   1. !HBP-v0 envelope trinity (.hbp/.hbi/.sha256/.hex) — structured tuple/payload/metadata
//   2. HBPv1 pipe-delimited rows (HBPv1|k=v|...) — rooms, ledgers, heartbeats, GNN edges
// JSON stays cold-egress only. This is the read-back tool the room->opencode dispatcher needs.
//
// Spec: C:/Users/acer/Asolaria/brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md
//       feedback_hbp_first_json_cold_only_2026_05_22 (durable rule)
// Pairs with: src/hbp-emitter.mjs (serializeEnvelope / writeHBP)

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { Buffer } from 'node:buffer';

const MAGIC = '!HBP-v0';
const MAGIC_HBI = '!HBI-v0';

// ── format detection ────────────────────────────────────────────────────────
export function detectFormat(text) {
  const head = text.slice(0, 64);
  if (head.startsWith(MAGIC)) return 'hbp-v0-envelope';
  if (head.startsWith(MAGIC_HBI)) return 'hbi-v0-index';
  if (/^HBPv1\|/m.test(head)) return 'hbpv1-pipe';
  if (head.startsWith('HBI1|')) return 'hbi1-pipe';
  return 'unknown';
}

// ── pipe-delimited HBPv1 rows (rooms, ledgers, heartbeats) ───────────────────
export function parsePipeRow(line) {
  const parts = String(line).trim().split('|');
  const fields = {};
  const tag = parts[0]; // e.g. HBPv1, GNN-EDGE, OMNIFILE-SHARE-ACCESS
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > 0) fields[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
    else if (parts[i]) fields['_' + i] = parts[i]; // positional, no key
  }
  return { tag, fields };
}

export function parsePipeFile(text) {
  return String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parsePipeRow);
}

// ── !HBP-v0 envelope format (emitter trinity) ────────────────────────────────
function tryParseValue(s) {
  // payload/metadata values may be canonicalStringify(JSON) or a raw string.
  // Attempt JSON; on failure return the raw string. Faithful for our use.
  const t = s.trim();
  if (t === '') return '';
  if (/^[[{"]/.test(t) || /^-?\d/.test(t) || t === 'true' || t === 'false' || t === 'null') {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  return s;
}

export function parseEnvelope(text) {
  const lines = String(text).split('\n');
  if (!lines[0] || !lines[0].startsWith(MAGIC)) {
    throw new TypeError(`parseEnvelope: missing ${MAGIC} header (got "${(lines[0] || '').slice(0, 24)}")`);
  }
  const headerType = lines[0].slice(MAGIC.length).trim(); // type after magic
  const env = { type: headerType || 'message' };
  let section = null;
  const tuple = [];
  const payloadLines = [];
  const metadata = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === `${MAGIC} end`) break;
    if (line === '[tuple]') { section = 'tuple'; continue; }
    if (line === '[payload]') { section = 'payload'; continue; }
    if (line === '[metadata]') { section = 'metadata'; continue; }

    if (section === 'tuple') {
      const m = line.match(/^D(\d+)=(.*)$/);
      if (m) tuple[Number(m[1]) - 1] = m[2];
    } else if (section === 'payload') {
      payloadLines.push(line);
    } else if (section === 'metadata') {
      const eq = line.indexOf('=');
      if (eq > 0) metadata[line.slice(0, eq)] = tryParseValue(line.slice(eq + 1));
    } else {
      // pre-section lines: type=...
      const eq = line.indexOf('=');
      if (eq > 0 && line.slice(0, eq) === 'type') env.type = line.slice(eq + 1);
    }
  }

  if (tuple.length) env.tupleTag = tuple;
  if (payloadLines.length) {
    const raw = payloadLines.join('\n');
    env.payload = tryParseValue(raw);
    env.rawPayload = raw;
  }
  if (Object.keys(metadata).length) env.metadata = metadata;
  return env;
}

// ── unified read ──────────────────────────────────────────────────────────
export function readHBP(path) {
  if (!existsSync(path)) throw new Error(`readHBP: not found: ${path}`);
  const text = readFileSync(path, 'utf8');
  const format = detectFormat(text);
  if (format === 'hbp-v0-envelope') return { format, envelope: parseEnvelope(text) };
  if (format === 'hbpv1-pipe' || format === 'hbi1-pipe') return { format, rows: parsePipeFile(text) };
  if (format === 'hbi-v0-index') return { format, rows: parsePipeFile(text.replace(/^!HBI-v0\n/, '')) };
  return { format: 'unknown', raw: text };
}

// ── verification: sha256 + hex sidecars ──────────────────────────────────────
export function verifyHBP(hbpPath) {
  const result = { hbpPath, sha_ok: null, hex_ok: null, hbi_ok: null, errors: [] };
  if (!existsSync(hbpPath)) { result.errors.push('hbp missing'); return result; }

  const bytes = readFileSync(hbpPath);
  const sha = createHash('sha256').update(bytes).digest('hex');
  result.sha256 = sha;
  result.bytes = bytes.length;

  // .sha256 sidecar: "<sha>  <basename>.hbp\n"
  const shaPath = hbpPath.replace(/\.hbp$/, '.sha256');
  if (existsSync(shaPath)) {
    const declared = readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0];
    result.sha_ok = declared === sha;
    if (!result.sha_ok) result.errors.push(`sha mismatch: declared ${declared.slice(0, 16)} vs actual ${sha.slice(0, 16)}`);
  }

  // .hex sidecar: bytes.toString('hex') wrapped at 64, joined \n
  const hexPath = hbpPath.replace(/\.hbp$/, '.hex');
  if (existsSync(hexPath)) {
    const hex = readFileSync(hexPath, 'utf8').replace(/\s+/g, '');
    const decoded = Buffer.from(hex, 'hex');
    result.hex_ok = decoded.equals(bytes);
    if (!result.hex_ok) result.errors.push('hex round-trip mismatch');
  }

  // .hbi index: sha256=<sha>, bytes=<n>
  const hbiPath = hbpPath.replace(/\.hbp$/, '.hbi');
  if (existsSync(hbiPath)) {
    const hbi = readFileSync(hbiPath, 'utf8');
    const declaredSha = (hbi.match(/sha256=([0-9a-f]+)/) || [])[1];
    const declaredBytes = (hbi.match(/bytes=(\d+)/) || [])[1];
    result.hbi_ok = declaredSha === sha && Number(declaredBytes) === bytes.length;
    if (!result.hbi_ok) result.errors.push('hbi sha/bytes mismatch');
  }

  result.ok = result.errors.length === 0;
  return result;
}

// ── quant decode hook (stub — wire to omniquant_engine cp-752 later) ─────────
export function decodeQuant(value /*, kind */) {
  // Quadruple quant (Polar+Turbo+JL+Zeta) decode lands here once the
  // omniquant_engine_4_quants_fused (cp-752) decode path is wired.
  // For now, identity passthrough so the dispatcher is unblocked.
  return { decoded: value, quant: 'passthrough', note: 'quant decode stub — wire omniquant cp-752' };
}

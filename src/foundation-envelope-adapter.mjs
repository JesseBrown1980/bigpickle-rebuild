// Foundation v1 envelope adapter.
//
// Pre-rebuild canon envelopes at C:/asolaria-foundation-v1/envelopes/ are JSON
// (`*.behcs-256.json`) shaped before the 2026-05-16 HBP hot-path canon. This
// adapter is a thin lossless wrapper: it reads the JSON, maps the canonical
// header fields into our internal envelope shape (type / tupleTag / payload /
// metadata) without dropping anything, and lets the rest of the pipeline
// (hookwall, hbp-emitter) treat it uniformly.
//
// JSON-in is allowed at this seam ONLY because the source artifacts predate
// the HBP discipline. Re-emission goes out as HBP+sidecars; the source JSON
// stays untouched on disk.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HEADER_FIELDS = ['verb', 'envelope_type', 'from', 'to', 'ts', 'envelope_id', 'anchor'];

function deriveTupleTag(raw) {
  // Best-effort mapping of canonical header fields to 47D positions.
  // Unmapped slots default to empty string per tuple-tag.mjs padding.
  const tag = new Array(47).fill('');
  tag[0] = String(raw.from ?? '');           // D1 ACTOR
  tag[1] = String(raw.verb ?? '');           // D2 VERB
  tag[2] = String(raw.to ?? '');             // D3 TARGET
  tag[15] = String(raw.envelope_id ?? '');   // D16 PID
  tag[19] = String(raw.ts ?? '');            // D20 TIME
  return tag;
}

export function adaptToInternal(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('adaptToInternal: raw must be a JSON object');
  }
  const metadata = {};
  for (const k of HEADER_FIELDS) {
    if (k in raw) metadata[k] = String(raw[k]);
  }
  return {
    type: String(raw.envelope_type ?? 'foundation-envelope'),
    tupleTag: deriveTupleTag(raw),
    payload: raw,
    metadata,
  };
}

export function loadFoundationEnvelope(jsonPath) {
  if (!existsSync(jsonPath)) {
    throw new Error(`loadFoundationEnvelope: file not found: ${jsonPath}`);
  }
  const text = readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(text);
  return adaptToInternal(parsed);
}

export function loadFoundationEnvelopes(dir, { pattern = /\.behcs-256\.json$/ } = {}) {
  if (!existsSync(dir)) return [];
  const st = statSync(dir);
  if (!st.isDirectory()) return [];
  const files = readdirSync(dir).filter((f) => pattern.test(f));
  return files.map((f) => ({
    file: f,
    envelope: loadFoundationEnvelope(join(dir, f)),
  }));
}

// NDJSON envelopes (e.g. T3-BACKFILL-PID-INDEX, T3-ORPHAN-PID-MINT-MANIFEST)
// are newline-delimited JSON where each line is a separate record. The
// foundation queue mixes both shapes; this loader handles the line-shape.

function adaptNdjsonLine(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('adaptNdjsonLine: parsed line must be an object');
  }
  const tag = new Array(47).fill('');
  tag[0] = String(raw.proposed_pid ?? raw.file ?? '');           // D1 ACTOR-ish
  tag[15] = String(raw.sha16 ?? (raw.sha256 ? raw.sha256.slice(0, 16) : '')); // D16 PID
  tag[37] = String(raw.sha256 ?? '');                            // D38 ENCRYPTION (sha256 attestation)
  return {
    type: String(raw.envelope_type ?? 'BACKFILL-PID-MANIFEST-LINE'),
    tupleTag: tag,
    payload: raw,
    metadata: {
      file: String(raw.file ?? ''),
      sha256: String(raw.sha256 ?? ''),
      sha16: String(raw.sha16 ?? ''),
      proposed_pid: String(raw.proposed_pid ?? ''),
      cp: String(raw.cp ?? ''),
      size: String(raw.size ?? ''),
    },
  };
}

export function loadFoundationNdjson(ndjsonPath) {
  if (!existsSync(ndjsonPath)) {
    throw new Error(`loadFoundationNdjson: file not found: ${ndjsonPath}`);
  }
  const text = readFileSync(ndjsonPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line, idx) => {
    try {
      const parsed = JSON.parse(line);
      return adaptNdjsonLine(parsed);
    } catch (err) {
      throw new Error(`loadFoundationNdjson: parse error on line ${idx + 1}: ${err.message}`);
    }
  });
}

export function loadFoundationNdjsonDir(dir, { pattern = /\.ndjson$/ } = {}) {
  if (!existsSync(dir)) return [];
  const st = statSync(dir);
  if (!st.isDirectory()) return [];
  const files = readdirSync(dir).filter((f) => pattern.test(f));
  return files.map((f) => ({
    file: f,
    envelopes: loadFoundationNdjson(join(dir, f)),
  }));
}

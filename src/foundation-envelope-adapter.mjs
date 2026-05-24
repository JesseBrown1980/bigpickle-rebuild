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

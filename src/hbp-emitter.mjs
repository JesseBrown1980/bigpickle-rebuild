// HBP packet emitter — writes .hbp + .hbi + .sha256 + .hex sidecar trinity.
// JSON is cold-egress only, never the default surface.
//
// Spec: C:/Users/acer/Asolaria/brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md
//       feedback_hbp_first_json_cold_only_2026_05_22 (durable rule)

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Buffer } from 'node:buffer';
import { TUPLE_DIMS } from './tuple-tag.mjs';

const MAGIC = '!HBP-v0';
const MAGIC_HBI = '!HBI-v0';

function canonicalStringify(value) {
  // Deterministic serialization for the SHA-stability invariant.
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

export function serializeEnvelope(envelope) {
  const type = envelope.type ?? 'message';
  const lines = [
    `${MAGIC} ${type}`,
    `type=${type}`,
  ];

  if (envelope.tupleTag) {
    lines.push('[tuple]');
    for (let i = 0; i < TUPLE_DIMS; i++) {
      const v = envelope.tupleTag[i] ?? '';
      lines.push(`D${i + 1}=${v}`);
    }
  }

  if (envelope.payload != null) {
    lines.push('[payload]');
    const payloadStr = typeof envelope.payload === 'string'
      ? envelope.payload
      : canonicalStringify(envelope.payload);
    lines.push(payloadStr);
  }

  if (envelope.metadata) {
    lines.push('[metadata]');
    const keys = Object.keys(envelope.metadata).sort();
    for (const k of keys) {
      const v = envelope.metadata[k];
      const vStr = typeof v === 'string' ? v : canonicalStringify(v);
      lines.push(`${k}=${vStr}`);
    }
  }

  lines.push(`${MAGIC} end`);
  return lines.join('\n');
}

export function writeHBP(destPath, envelope, opts = {}) {
  if (typeof destPath !== 'string' || destPath.length === 0) {
    throw new TypeError('writeHBP: destPath must be a non-empty string');
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new TypeError('writeHBP: envelope must be an object');
  }

  const body = serializeEnvelope(envelope);
  const bytes = Buffer.from(body, 'utf8');
  const sha = createHash('sha256').update(bytes).digest('hex');

  const hbpPath = `${destPath}.hbp`;
  const hbiPath = `${destPath}.hbi`;
  const shaPath = `${destPath}.sha256`;
  const hexPath = `${destPath}.hex`;

  writeFileSync(hbpPath, body, 'utf8');
  writeFileSync(shaPath, `${sha}  ${basename(hbpPath)}\n`, 'utf8');
  writeFileSync(hexPath, bytes.toString('hex').match(/.{1,64}/g).join('\n') + '\n', 'utf8');

  const hbi = [
    MAGIC_HBI,
    `packet=${basename(hbpPath)}`,
    `bytes=${bytes.length}`,
    `sha256=${sha}`,
    `type=${envelope.type ?? 'message'}`,
  ].join('\n');
  writeFileSync(hbiPath, hbi + '\n', 'utf8');

  const result = {
    hbp: hbpPath,
    hbi: hbiPath,
    sha256: shaPath,
    hex: hexPath,
    sha,
    bytes: bytes.length,
  };

  if (opts.cold === true) {
    const jsonPath = `${destPath}.cold.json`;
    writeFileSync(jsonPath, JSON.stringify(envelope, null, 2), 'utf8');
    result.json = jsonPath;
  }

  return result;
}

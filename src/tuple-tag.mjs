// 47D tuple-tag encoding for the Asolaria hyperlanguage.
// Spec: C:/asolaria-foundation-v1/03-CUBE-OF-CUBES.md (47D live, 49D proposal)
//
// Wire format (binary, deterministic):
//   [uint16-be length][utf8 bytes] × TUPLE_DIMS
// One length-prefixed slot per dimension. Short tuples are right-padded with
// empty strings; long tuples are truncated to TUPLE_DIMS.

import { Buffer } from 'node:buffer';

export const TUPLE_DIMS = 47;
const MAX_VALUE_BYTES = 0xffff; // uint16 cap per slot

export function encodeTupleTag(tuple) {
  if (!Array.isArray(tuple)) {
    throw new TypeError('encodeTupleTag: tuple must be array');
  }
  const padded = Array.from({ length: TUPLE_DIMS }, (_, i) => {
    const raw = tuple[i];
    return raw == null ? '' : String(raw);
  });
  const chunks = [];
  for (const val of padded) {
    const valBytes = Buffer.from(val, 'utf8');
    if (valBytes.length > MAX_VALUE_BYTES) {
      throw new RangeError(
        `encodeTupleTag: value length ${valBytes.length} exceeds uint16 cap ${MAX_VALUE_BYTES}`
      );
    }
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(valBytes.length, 0);
    chunks.push(lenBuf, valBytes);
  }
  return Buffer.concat(chunks);
}

export function decodeTupleTag(bytes) {
  const buf = Buffer.from(bytes);
  const tuple = [];
  let offset = 0;
  while (tuple.length < TUPLE_DIMS && offset + 2 <= buf.length) {
    const len = buf.readUInt16BE(offset);
    offset += 2;
    const end = Math.min(offset + len, buf.length);
    tuple.push(buf.slice(offset, end).toString('utf8'));
    offset = end;
  }
  while (tuple.length < TUPLE_DIMS) tuple.push('');
  return tuple;
}

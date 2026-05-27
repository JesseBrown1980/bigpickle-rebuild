// Hot-tuple validator — assert single-line tuple shape for hot hookwall state.
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #2 (one_line_hot_tuple):
// "Hot hookwall state is a one-line tuple with pointer IDs and hashes."
//
// Pairs with src/warm-expansion.mjs (Dan-fix #3) which expands selected
// hot tuples into 35-line warm profiles.
//
// Pure function. No side effects.

export const HOT_TUPLE_FIELDS = Object.freeze(['pid', 'row_hash', 'ts']);

// validateHotTuple asserts the tuple is exactly { pid, row_hash, ts } shape.
// Returns { ok: true, tuple } on success or { ok: false, error } on failure.
// Throws nothing — fail-soft per BH-15 hot-path discipline.
export function validateHotTuple(input) {
  if (input === null || input === undefined) {
    return { ok: false, error: 'hot-tuple: input is null/undefined' };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'hot-tuple: input must be a non-array object' };
  }
  const keys = Object.keys(input);
  if (keys.length !== HOT_TUPLE_FIELDS.length) {
    return {
      ok: false,
      error: `hot-tuple: must have exactly ${HOT_TUPLE_FIELDS.length} fields ${HOT_TUPLE_FIELDS.join(',')}; got ${keys.length} (${keys.join(',')})`,
    };
  }
  for (const field of HOT_TUPLE_FIELDS) {
    if (!(field in input)) {
      return { ok: false, error: `hot-tuple: missing required field "${field}"` };
    }
  }
  if (typeof input.pid !== 'string' || input.pid.length === 0) {
    return { ok: false, error: 'hot-tuple: pid must be a non-empty string' };
  }
  if (typeof input.row_hash !== 'string' || input.row_hash.length === 0) {
    return { ok: false, error: 'hot-tuple: row_hash must be a non-empty string' };
  }
  if (typeof input.ts !== 'number' || !Number.isFinite(input.ts)) {
    return { ok: false, error: 'hot-tuple: ts must be a finite number (ms since epoch)' };
  }
  return { ok: true, tuple: { pid: input.pid, row_hash: input.row_hash, ts: input.ts } };
}

// Serialize a validated hot tuple to a single-line pipe-delimited HBPv1-style row.
export function serializeHotTuple(tuple) {
  const v = validateHotTuple(tuple);
  if (!v.ok) throw new Error(`serializeHotTuple: ${v.error}`);
  return `HBPv1|pid=${v.tuple.pid}|row_hash=${v.tuple.row_hash}|ts=${v.tuple.ts}`;
}

// Count newlines — a properly-serialized hot tuple has zero newlines.
export function newlineCount(serialized) {
  return (serialized.match(/\n/g) || []).length;
}

export const STATUS = Object.freeze({
  schema: 'hot-tuple-validator.v1',
  fields: HOT_TUPLE_FIELDS,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_2_one_line_hot_tuple',
  pairs_with: 'src/warm-expansion.mjs (Dan-fix #3)',
});

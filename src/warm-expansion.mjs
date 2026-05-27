// Warm-expansion — selected-tile warm profile, bounded at 35 lines.
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #3 (warm_expansion_limit):
// "The old 35-line profile survives only as selected-row warm expansion."
//
// Pairs with src/hot-tuple-validator.mjs (Dan-fix #2). Hot stays 1-line;
// only selected tiles expand to warm (capped at 35 lines).
//
// Pure functions. No I/O.

import { validateHotTuple } from './hot-tuple-validator.mjs';

export const WARM_MAX_LINES = 35;

// expandToWarm takes a validated hot tuple + a profile body (array of strings,
// one per line) and returns a warm profile bounded at WARM_MAX_LINES.
// Lines beyond WARM_MAX_LINES are truncated; truncation marker appended.
export function expandToWarm(hotTuple, profileLines = []) {
  const v = validateHotTuple(hotTuple);
  if (!v.ok) throw new Error(`expandToWarm: ${v.error}`);
  if (!Array.isArray(profileLines)) {
    throw new TypeError('expandToWarm: profileLines must be an array of strings');
  }
  const header = `# warm-profile pid=${v.tuple.pid} row_hash=${v.tuple.row_hash} ts=${v.tuple.ts}`;
  const reservedForHeaderAndMarker = 2;
  const maxBodyLines = WARM_MAX_LINES - reservedForHeaderAndMarker;
  const truncated = profileLines.length > maxBodyLines;
  const body = profileLines.slice(0, maxBodyLines).map((line) => String(line));
  const lines = [header, ...body];
  if (truncated) {
    lines.push(`# truncated: ${profileLines.length - maxBodyLines} additional lines elided per WARM_MAX_LINES=${WARM_MAX_LINES}`);
  } else {
    lines.push(`# end-of-warm-profile (${body.length} body lines)`);
  }
  return {
    lines,
    lineCount: lines.length,
    truncated,
    elidedCount: truncated ? profileLines.length - maxBodyLines : 0,
  };
}

// collapseToHot reverses warm expansion — extracts the hot tuple from a warm
// profile header. Returns { ok, tuple } or { ok: false, error }.
export function collapseToHot(warmLines) {
  if (!Array.isArray(warmLines) || warmLines.length === 0) {
    return { ok: false, error: 'collapseToHot: warmLines must be a non-empty array' };
  }
  const header = warmLines[0];
  const match = /^# warm-profile pid=(\S+) row_hash=(\S+) ts=(\d+)$/.exec(header);
  if (!match) {
    return { ok: false, error: 'collapseToHot: header does not match warm-profile shape' };
  }
  return {
    ok: true,
    tuple: { pid: match[1], row_hash: match[2], ts: Number(match[3]) },
  };
}

export const STATUS = Object.freeze({
  schema: 'warm-expansion.v1',
  warm_max_lines: WARM_MAX_LINES,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_3_warm_expansion_limit',
  pairs_with: 'src/hot-tuple-validator.mjs (Dan-fix #2)',
});

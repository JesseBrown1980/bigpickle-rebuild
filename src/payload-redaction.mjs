// Payload redaction — cold-keep raw fields until authority granted.
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #4 (no_full_payload_hydration):
// "Raw files, transcripts, secrets, and chat bodies stay cold until authority."
//
// Pure function. Strips raw/sensitive fields from a payload by default,
// leaving only pointer-IDs and hashes. Caller can override with explicit
// authorityLevel >= staging to allow specific fields through.
//
// Backed by 1M run breath_pacing_feedback (742 marks) + claim_quarantine (723).

import { AUTHORITY_LEVELS } from './universal-route.mjs';

// Fields known-cold (always stripped unless explicitly allowed at staging+).
export const COLD_FIELDS = Object.freeze([
  'raw',
  'rawBody',
  'transcript',
  'secret',
  'credential',
  'token',
  'apiKey',
  'password',
  'chatBody',
  'fileContent',
  'biosignal',
  'rawBiosignal',
  'consentSignedBody',
]);

// Pointer-fields safe to keep hot at any authority level.
export const HOT_SAFE_FIELDS = Object.freeze([
  'pid', 'row_hash', 'ts', 'sha256', 'sha16', 'pointer', 'event',
  'channel', 'vantage', 'subnet_h', 'cosign_seq', 'cosign_row',
  'authorityLevel', 'sourceClass', 'edgeClass', 'imageClass',
]);

const AUTHORITY_RANK = {
  [AUTHORITY_LEVELS.PRE_DEV]: 0,
  [AUTHORITY_LEVELS.DEV]: 1,
  [AUTHORITY_LEVELS.STAGING]: 2,
  [AUTHORITY_LEVELS.PROD]: 3,
};

const STAGING_RANK = AUTHORITY_RANK[AUTHORITY_LEVELS.STAGING];

// redactPayload returns a copy of payload with cold fields stripped unless
// authorityLevel >= staging AND the field is in opts.allowAtStaging.
//
// args:
//   payload: object to redact (returns null/undefined unchanged)
//   authorityLevel: ∈ AUTHORITY_LEVELS (default 'dev')
//   opts: { allowAtStaging: string[] of field names to keep at staging+ }
export function redactPayload(payload, authorityLevel = AUTHORITY_LEVELS.DEV, opts = {}) {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object' || Array.isArray(payload)) return payload;

  const rank = AUTHORITY_RANK[authorityLevel];
  if (rank === undefined) {
    throw new RangeError(`redactPayload: unknown authorityLevel "${authorityLevel}"`);
  }

  const allowSet = new Set(opts.allowAtStaging || []);
  const result = {};
  const stripped = [];
  for (const [k, v] of Object.entries(payload)) {
    const isCold = COLD_FIELDS.includes(k);
    if (!isCold) {
      result[k] = v;
      continue;
    }
    // Cold field — keep only if authority >= staging AND explicitly allowed
    if (rank >= STAGING_RANK && allowSet.has(k)) {
      result[k] = v;
    } else {
      stripped.push(k);
    }
  }
  if (stripped.length > 0) {
    result._redacted = stripped;
    result._redactionAuthority = authorityLevel;
  }
  return result;
}

export const STATUS = Object.freeze({
  schema: 'payload-redaction.v1',
  cold_fields: COLD_FIELDS,
  hot_safe_fields: HOT_SAFE_FIELDS,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_4_no_full_payload_hydration',
  pairs_with: 'src/universal-route.mjs authorityLevel field (Dan-fix #9)',
});

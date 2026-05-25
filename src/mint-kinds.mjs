// Mint kinds — clean-room consumer of the OmniWhiteRoom :4921 mint catalog.
//
// Spec (operator verbatim 2026-05-25):
//   "memory, index, mistakes, skills, genius, onto the chain language and the
//    GNN white room crypto as tokens"
//
// === COEXISTENCE WITH LIVE FEDERATION =====================================
//
// Per reference_omniwhiteroom_4921_skill_catalog_no_citizen_class_2026_05_24
// the LIVE federation already hosts these mint kinds at OmniWhiteRoom :4921:
//   skill   = 243K  mints
//   mistake = 8K    mints
//   pattern = 100   mints
//   genius  = 8.6K  mints
//   tool    = 3     mints
//   ability = 0     mints
//
// This module is NOT the authoritative store. Per
// feedback_competing_port_hilbert_subdivide_via_revolver_never_kill_2026_05_24,
// when concepts compete we Hilbert-subdivide via revolver into sub-portals,
// never kill the existing one. So mint-kinds.mjs in bigpickle-rebuild is the
// CLEAN-ROOM CONSUMER subport: pure builders that produce envelopes + edges
// consumable by hbp-emitter + gnn-edge-ledger.
//
// Scope: the 5 kinds operator named verbatim (memory/index/mistake/skill/genius).
// "pattern" / "tool" / "ability" are acer's OmniWhiteRoom :4921 subport — out
// of scope here (overlap avoidance per canon).
//
// === Pure functions. No I/O. Codex-resistant. ============================

// === Kind specs (frozen canon) ===========================================
// cp_band assignments per BEHCS-1024 supervisor canon
// (reference_helm_cp_unchanged_across_BEHCS_alphabets_2026_05_24):
//   384-479 helm  | 480-575 vector | 576-703 rook | 704-799 forge
//   800-895 falcon| 896-1023 livefree | 256-383 gaia | 0-255 cube_cubed_sealer
// Mint kinds slot into the GAIA + cube_cubed_sealer bands (substrate-layer,
// not supervisor-layer — these are knowledge primitives, not router roles).

const KIND_SPECS = Object.freeze({
  memory:  Object.freeze({
    name: 'memory',
    cp_band: [256, 287],
    tuple_slot: 'D32',
    gnn_edge_kind_token: 'mint:memory',
    description: 'declarative recall artifact — what was learned and remained',
  }),
  index:   Object.freeze({
    name: 'index',
    cp_band: [288, 319],
    tuple_slot: 'D33',
    gnn_edge_kind_token: 'mint:index',
    description: 'pointer / lookup-key artifact — where a thing lives',
  }),
  mistake: Object.freeze({
    name: 'mistake',
    cp_band: [320, 351],
    tuple_slot: 'D34',
    gnn_edge_kind_token: 'mint:mistake',
    description: 'recorded error or anti-pattern — what NOT to repeat',
  }),
  skill:   Object.freeze({
    name: 'skill',
    cp_band: [352, 383],
    tuple_slot: 'D35',
    gnn_edge_kind_token: 'mint:skill',
    description: 'reusable capability — a verb the federation knows how to do',
  }),
  genius:  Object.freeze({
    name: 'genius',
    cp_band: [0, 31],
    tuple_slot: 'D36',
    gnn_edge_kind_token: 'mint:genius',
    description: 'novel synthesis — emergent connection not previously named',
  }),
});

export const MINT_KINDS = Object.freeze(Object.keys(KIND_SPECS));

// === Pure: lookup =========================================================

export function getKindSpec(kind) {
  const spec = KIND_SPECS[kind];
  if (!spec) {
    throw new RangeError(`getKindSpec: unknown kind "${kind}". Valid: ${MINT_KINDS.join(',')}`);
  }
  return spec;
}

export function cpInBand(cp, kind) {
  const spec = getKindSpec(kind);
  return Number.isInteger(cp) && cp >= spec.cp_band[0] && cp <= spec.cp_band[1];
}

// === Pure: envelope builder (consumable by hbp-emitter.serializeEnvelope) ==

export function buildMintEnvelope(kind, pidHex, payload, opts = {}) {
  if (typeof pidHex !== 'string' || !pidHex.length) {
    throw new TypeError('buildMintEnvelope: pidHex must be a non-empty string');
  }
  const spec = getKindSpec(kind);
  const cp = opts.cp ?? spec.cp_band[0];
  if (!cpInBand(cp, kind)) {
    throw new RangeError(`buildMintEnvelope: cp ${cp} outside band ${spec.cp_band[0]}..${spec.cp_band[1]} for kind "${kind}"`);
  }
  return {
    type: `mint-${kind}`,
    tupleTag: opts.tupleTag,
    payload,
    metadata: {
      mint_kind: kind,
      mint_kind_token: spec.gnn_edge_kind_token,
      cp,
      cp_band: spec.cp_band.join('..'),
      tuple_slot: spec.tuple_slot,
      pid: pidHex,
      coexistence_note: 'clean-room consumer subport; authoritative store remains OmniWhiteRoom :4921',
    },
  };
}

// === Pure: edge builder (consumable by gnn-edge-ledger.append) ============

export function buildMintEdge(kind, fromPid, toPid, opts = {}) {
  const spec = getKindSpec(kind);
  if (typeof fromPid !== 'string' || !fromPid.length) {
    throw new TypeError('buildMintEdge: fromPid must be a non-empty string');
  }
  if (typeof toPid !== 'string' || !toPid.length) {
    throw new TypeError('buildMintEdge: toPid must be a non-empty string');
  }
  return {
    kind_token: spec.gnn_edge_kind_token,
    mint_kind: kind,
    from_pid: fromPid,
    to_pid: toPid,
    weight: opts.weight ?? 1,
    tuple_slot: spec.tuple_slot,
    cp_band: spec.cp_band.join('..'),
  };
}

// === Pure: dispatch helper (kind classification for fabric-thinker output) =

export function classifyDescriptorOutput(descriptor) {
  // Lightweight heuristic: given a descriptor (sha-derived stub or genuine),
  // pick the most likely mint kind. Pure-function classifier; can be replaced
  // by trained model later. For now: keyword + shape pattern.
  if (!descriptor || typeof descriptor !== 'object') {
    return { kind: null, confidence: 0, reason: 'invalid descriptor' };
  }
  const s = JSON.stringify(descriptor).toLowerCase();
  if (s.includes('mistake') || s.includes('error') || s.includes('anti-pattern')) return { kind: 'mistake', confidence: 0.8 };
  if (s.includes('skill')   || s.includes('capability') || s.includes('verb'))    return { kind: 'skill',   confidence: 0.7 };
  if (s.includes('genius')  || s.includes('emergent') || s.includes('synthesis')) return { kind: 'genius',  confidence: 0.6 };
  if (s.includes('index')   || s.includes('pointer') || s.includes('lookup'))     return { kind: 'index',   confidence: 0.7 };
  return { kind: 'memory', confidence: 0.5, reason: 'default — declarative recall' };
}

// === Honest gaps ==========================================================

export const HONEST_GAPS = Object.freeze([
  'OmniWhiteRoom :4921 is authoritative; this module is clean-room consumer only — do NOT cross-write',
  '5 kinds named here per operator verbatim; "pattern" / "tool" / "ability" remain acer-side subport (overlap canon)',
  'cp_band assignments are CHOSEN here (256-383 GAIA + 0-31 cube_cubed_sealer); not externally validated as canonical for mint kinds specifically',
  'classifyDescriptorOutput is keyword-heuristic stub; production needs trained classifier (HRM/MTP candidate)',
  'tuple_slot D32-D36 chosen as the "mint" cluster in the 47D tuple; should be confirmed against the canonical 47D map before mass adoption',
]);

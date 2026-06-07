// BHFISCHER-KERNEL-v1 — Anti-blunder evaluator for the Asolaria fabric.
//
// Sits between VERIFY and HOOKWALL. Scores every candidate envelope/spawn/
// route/write on 5 axes and returns a verdict + centipawn-loss (CPL) in
// HBP pipe-row format. NEVER self-authorizes. json=0 always.
//
// Pipeline position:
//   VERIFY → [FISCHER-EVAL] → HOOKWALL → ROUTE → HBP+HBI+SHA+HEX+RECEIPT
//
// PIXELS FIRST: HBI sidecar is the human-readable row. HBP is the hot path.
// Operator: Jesse Daniel Brown — Post-BigPickle Layer-8. 2026-06-06.

import { createHash } from 'node:crypto';
import { hilbertEncode } from './hilbert.mjs';

function sha8(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 8); }
function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }

// ── VOXEL COORDINATE — maps PID to 3D Hilbert coordinate ─────────────────────
// Uses 3D Hilbert curve (dims=3, bits=4 = 4096 positions, covers 739-voxel atlas)
function pidToVoxelCoord(pid) {
  const h = sha16(pid);
  const x = parseInt(h.slice(0, 4), 16) % 16;
  const y = parseInt(h.slice(4, 8), 16) % 16;
  const z = parseInt(h.slice(8, 12), 16) % 16;
  try {
    const idx = hilbertEncode([x, y, z], { dimensions: 3, bits: 4 });
    return `BH3D:${idx}`;
  } catch {
    return `BH3D:${x}-${y}-${z}`;
  }
}

// ── BEST ALTERNATIVE — Fischer says which move was better ─────────────────────
function deriveBestAlt(flags, verb, glsmState) {
  if (glsmState === 'MISTAKE_FLAGGED') return 'analyze_in_white_room';
  if (flags.includes('authority_jump')) return 'escalate_via_cosign_ring';
  if (flags.includes('recursive_consent')) return 'halt_and_request_human_apex';
  if (flags.includes('missing_cosign')) return 'hold_for_cosign';
  if (flags.includes('missing_halt_path')) return 'declare_halt_path_first';
  if (flags.includes('unsealed_write')) return 'seal_with_hbp_before_write';
  if (flags.includes('no_replay_path')) return 'declare_ledger_path_first';
  if (flags.includes('missing_operator_witness')) return 'request_operator_witness';
  if (flags.includes('bloat_delta')) return 'compact_payload_to_tuple';
  if (SPAWN_VERBS.has(verb)) return 'send_to_white_room_first';
  if (WRITE_VERBS.has(verb)) return 'compact_then_seal';
  return 'hold_for_analysis';
}

// ── CANDIDATE COUNT — how many alternatives were evaluated ────────────────────
function deriveCandidateCount(verb) {
  if (SPAWN_VERBS.has(verb)) return 4; // spawn / white-room / hold-for-cosign / compact-first
  if (WRITE_VERBS.has(verb)) return 3; // write / seal-first / hold
  if (COSIGN_REQUIRED.has(verb)) return 3; // promote / hold / escalate
  return 2; // proceed / hold
}

// ── BEHCS-1024 GLYPH ENCODING — compact tokens for AgentTerms :5054 ──────────
const VERDICT_GLYPH = Object.freeze({
  PROCEED: 'FP',   // Fischer Proceed — best move, no wasted tempo
  HOLD:    'FH',   // Fischer Hold — playable, needs more proof
  BLOCK:   'FB',   // Fischer Block — blunder or illegal
  REFUTE:  'FR',   // Fischer Refute — known bad pattern
  ANALYZE: 'FA',   // Fischer Analyze — send to white-room / GNN
});

// G4 GLSM STATE WEIGHTS (how GLSM state modifies CPL) ─────────────────────────
const GLSM_CPL_MOD = Object.freeze({
  DESCRIBED:      0,    // neutral — just started
  EDGE_MINED:   -40,    // gaining structure — reward
  PATH_FOUND:   -80,    // clear path — significant reward
  CONVERGED:   -200,    // strongest signal — major reward
  MISTAKE_FLAGGED: 999, // hard floor — force BLOCK regardless of gains
});

// ── VERDICTS ──────────────────────────────────────────────────────────────────
export const VERDICT = Object.freeze({
  PROCEED: 'PROCEED',   // cpl < 150 — best available legal move
  HOLD:    'HOLD',      // 150 <= cpl < 500 — playable but needs cosign/white-room
  BLOCK:   'BLOCK',     // cpl >= 500 — blunder, illegal, or authority-violating
  REFUTE:  'REFUTE',    // known bad pattern — bypasses CPL, rejected immediately
  ANALYZE: 'ANALYZE',   // needs white-room / GNN / watcher before proceeding
});

// ── REFUTE LOOKUP — known bad patterns, checked FIRST before CPL ──────────────
const REFUTED_VERBS = new Set([
  'self_authorize', 'bypass_hookwall', 'recursive_consent',
  'force_promote', 'skip_cosign', 'delete_evidence',
  'disable_halt', 'grant_authority',
]);

const REFUTED_PATTERNS = [
  (env) => REFUTED_VERBS.has(env.verb),
  (env) => env.actor && env.actor === env.target && isPromotionVerb(env.verb),
  (env) => env.payload && typeof env.payload === 'object' && env.payload.json === true,
  (env) => env.authority_jump === true && !env.cosign,
];

function isPromotionVerb(v) {
  return v && ['promote', 'mint', 'seal', 'authorize', 'cosign'].includes(v);
}

function checkRefuted(envelope) {
  for (const pred of REFUTED_PATTERNS) {
    try { if (pred(envelope)) return true; } catch { /* predicate errors = not refuted */ }
  }
  return false;
}

// ── 3-TIER EVALUATION ────────────────────────────────────────────────────────
//
// Tier 1 — ILLEGAL  (immediate BLOCK, gains cannot cancel):
//   missing_pid, missing_verb — envelope cannot exist in the ledger
//
// Tier 2 — REFUTED  (immediate REFUTE, bypasses CPL entirely):
//   known bad patterns: self_authorize, bypass_hookwall, recursive_consent, etc.
//
// Tier 3 — CPL FORMULA  (centipawn loss, gains can offset penalties):
//
// Penalties (hard-floor — gains cannot bring below their floor):
//   +400  authority_jump  — claims authority not in cosign chain (floor=400)
//   +350  missing_halt    — spawn/scale verb with no halt path (floor=200)
//   +250  missing_cosign  — cosign required for verb but absent (floor=150)
//   +220  unsealed_write  — write/delete verb with no replay/proof path
//   +180  no_replay_path  — cannot be audited (floor=100)
//   +120  entropy_delta   — content entropy spike (injection/bloat signal)
//   +100  bloat_delta     — oversized payload (> threshold)
//   + 80  route_ambiguity — no clear target or multi-target conflict
//
// Gains (subtract from CPL — cannot bring CPL below hard floors above):
//   -160  proof_gain      — HBP row or sidecar path declared
//   -140  reproducible    — deterministic PID present
//   -120  compaction_gain — compact/gc/drain verb (improves fabric health)
//   -100  gnn_observable  — L0 GNN score is real (not fallback)
//   - 80  cube_local      — cube_47d or tuple field present

const WRITE_VERBS  = new Set(['write', 'delete', 'compact', 'seal', 'upsert', 'drop', 'migrate']);
const SPAWN_VERBS  = new Set(['spawn', 'scale', 'mint', 'fork', 'launch', 'bootstrap']);
const COMPACT_VERBS = new Set(['compact', 'gc', 'drain', 'prune', 'archive']);
const COSIGN_REQUIRED = new Set(['promote', 'mint', 'seal', 'authorize', 'cosign', 'scale']);
const PAYLOAD_BLOAT_BYTES = 65536; // 64 KB — flag as bloat above this

// illegal conditions — gains CANNOT cancel these; returns early with BLOCK verdict signal
function checkIllegal(envelope) {
  if (!envelope.pid) return 'missing_pid';
  if (!envelope.verb) return 'missing_verb';
  return null;
}

function computeCPL(envelope, scoreResult) {
  let cpl = 0;
  let hardFloor = 0; // gains cannot bring CPL below this
  const flags = [];

  const verb = envelope.verb || '';
  const payloadStr = typeof envelope.payload === 'string'
    ? envelope.payload
    : JSON.stringify(envelope.payload ?? '');

  // ── AXIS 1: LEGALITY ─────────────────────────────────────────────────────
  // (missing_pid / missing_verb handled by checkIllegal — already returned by caller)
  if (COSIGN_REQUIRED.has(verb) && !envelope.cosign) {
    cpl += 250; hardFloor = Math.max(hardFloor, 150); flags.push('missing_cosign');
  }
  if (envelope.authority_jump) {
    cpl += 400; hardFloor = Math.max(hardFloor, 400); flags.push('authority_jump');
  }

  // ── AXIS 2: KING SAFETY (human-apex / HALT boundary) ─────────────────────
  if (SPAWN_VERBS.has(verb) && !envelope.halt_path) {
    cpl += 350; hardFloor = Math.max(hardFloor, 200); flags.push('missing_halt_path');
  }
  if (envelope.recursive_consent) {
    cpl += 400; hardFloor = Math.max(hardFloor, 400); flags.push('recursive_consent');
  }
  if (envelope.operator_witness_required && !envelope.operator_witness) {
    cpl += 300; hardFloor = Math.max(hardFloor, 150); flags.push('missing_operator_witness');
  }

  // ── AXIS 3: CENTER CONTROL (proof / route clarity / GNN observability) ────
  const hasProofPath = !!(envelope.hbp_path || envelope.sidecar_plan || envelope.ledger_path);
  if (!hasProofPath) {
    cpl += 180; hardFloor = Math.max(hardFloor, 100); flags.push('no_replay_path');
  } else {
    cpl -= 160; flags.push('proof_gain');
  }
  if (!envelope.target) {
    cpl += 80; flags.push('route_ambiguity');
  }
  if (scoreResult && scoreResult.l0_real) {
    cpl -= 100; flags.push('gnn_observable');
  }

  // ── AXIS 4: TACTICAL SOUNDNESS (bloat / entropy / write sealing) ──────────
  if (WRITE_VERBS.has(verb) && !COMPACT_VERBS.has(verb) && !hasProofPath) {
    cpl += 220; flags.push('unsealed_write');
  }
  if (payloadStr.length > PAYLOAD_BLOAT_BYTES) {
    cpl += 100; flags.push('bloat_delta');
  }
  if (scoreResult && scoreResult.signals) {
    const shannonScore = scoreResult.signals.shannon ?? 0;
    if (shannonScore > 0.92 && !['write', 'export', 'generate'].includes(verb)) {
      cpl += 120; flags.push('entropy_delta');
    }
  }

  // ── AXIS 5: ENDGAME CONVERSION (reproducibility / cube locality) ──────────
  if (envelope.pid && envelope.pid.startsWith('BH.')) {
    cpl -= 140; flags.push('reproducible');
  }
  if (envelope.cube_47d || envelope.tuple) {
    cpl -= 80; flags.push('cube_local');
  }
  if (COMPACT_VERBS.has(verb)) {
    cpl -= 120; flags.push('compaction_gain');
  }

  // Apply hard floor — gains cannot reduce CPL below safety minimums
  const finalCpl = Math.max(0, Math.max(cpl, hardFloor));
  return { cpl: finalCpl, flags };
}

// ── AXIS SUMMARIES (for HBI human-readable sidecar) ──────────────────────────
function axisScores(envelope, scoreResult, cpl) {
  const verb = envelope.verb || '';
  const hasHalt = SPAWN_VERBS.has(verb) ? !!envelope.halt_path : true;
  const hasProof = !!(envelope.hbp_path || envelope.sidecar_plan || envelope.ledger_path);
  const hasCosign = !COSIGN_REQUIRED.has(verb) || !!envelope.cosign;
  const hasTarget = !!envelope.target;
  const hasGnn = !!(scoreResult && scoreResult.l0_real);
  const hasCube = !!(envelope.cube_47d || envelope.tuple);

  const king_safety = hasHalt && !envelope.authority_jump && !envelope.recursive_consent ? 1.000 : 0.000;
  const center_gain = +((
    (hasProof ? 0.4 : 0) +
    (hasTarget ? 0.3 : 0) +
    (hasGnn ? 0.2 : 0) +
    (hasCube ? 0.1 : 0)
  ).toFixed(3));
  const proof_gain = hasProof ? 1.000 : 0.000;
  const authority_debt = (envelope.authority_jump ? 1 : 0) + (!hasCosign ? 1 : 0);

  return { king_safety, center_gain, proof_gain, authority_debt };
}

// ── HBP ROW EMITTER (hot path — no JSON) ─────────────────────────────────────
// Uses `move=` (spec canonical field name) not `verb=`
function buildRow(pid, move, verdict, cpl, axes, flags, scoreResult, prevHash, extras = {}) {
  const l0_real = !!(scoreResult && scoreResult.l0_real);
  const composite = scoreResult ? scoreResult.composite : 0;
  const g4_state = (scoreResult && scoreResult.signals && scoreResult.signals.g4_state) || 'UNKNOWN';
  const base = [
    'FISCHERv1',
    `pid=${pid}`,
    `move=${move}`,                               // spec: move= not verb=
    `verdict=${verdict}`,
    `cpl=${cpl}`,
    `candidate_count=${extras.candidate_count ?? 2}`,  // spec: candidate_count
    `best_alt=${extras.best_alt ?? 'hold_for_analysis'}`, // spec: best_alt
    `king_safety=${axes.king_safety.toFixed(3)}`,
    `center_gain=${axes.center_gain.toFixed(3)}`,
    `proof_gain=${axes.proof_gain.toFixed(3)}`,
    `authority_debt=${axes.authority_debt}`,
    `g4_state=${g4_state}`,                       // G4 GLSM state visible in HBP
    `voxel_coord=${extras.voxel_coord ?? 'BH3D:0'}`,  // 3D voxel atlas position
    `glyph=${extras.glyph ?? 'FH'}`,              // BEHCS-1024 compact token
    `flags=${flags.join(',')}`,
    `l0_real=${l0_real ? 1 : 0}`,
    `composite=${composite}`,
    `prev_hash=${prevHash || '0000000000000000'}`,
    `ts=${ts()}`,
    'json=0',
    'runtime=0',
  ];
  const rowHash = sha8(base.join('|'));
  base.push(`row_hash=${rowHash}`);
  return { row: base.join('|'), rowHash };
}

// ── HBI ROW (PIXELS FIRST — human-readable before GPU) ───────────────────────
function buildHbiRow(pid, move, verdict, cpl, axes, flags, rowHash, extras = {}) {
  const flag_summary = flags.length ? flags.join(' · ') : 'clean';
  return [
    `FISCHER HBI`,
    `pid        : ${pid}`,
    `move       : ${move}`,
    `verdict    : ${verdict}  (cpl=${cpl})  glyph=${extras.glyph ?? 'FH'}`,
    `g4_state   : ${extras.g4_state ?? 'UNKNOWN'}`,
    `voxel_coord: ${extras.voxel_coord ?? 'BH3D:0'}`,
    `best_alt   : ${extras.best_alt ?? 'hold_for_analysis'}`,
    `candidates : ${extras.candidate_count ?? 2}`,
    `king_safe  : ${axes.king_safety.toFixed(3)}  center: ${axes.center_gain.toFixed(3)}  proof: ${axes.proof_gain.toFixed(3)}`,
    `auth_debt  : ${axes.authority_debt}`,
    `flags      : ${flag_summary}`,
    `row_hash   : ${rowHash}`,
    '',
  ].join('\n');
}

// ── THE EVAL — one function, pure, sync, deterministic ───────────────────────
//
// fischerEval(pid, envelope, scoreResult, opts?)
//   → { verdict, cpl, flags, axes, row, rowHash, hbi, pass, move, best_alt, candidate_count, glyph, voxel_coord, g4_state }
//
// opts:
//   prevHash  — string, previous row hash for chain linking
//   strict    — bool, if true ANALYZE becomes HOLD (white-room required)
export function fischerEval(pid, envelope, scoreResult, opts = {}) {
  const move = (envelope && envelope.verb) ? envelope.verb : (envelope ? 'unknown' : '?');
  const voxel_coord = pidToVoxelCoord(pid || 'UNKNOWN');
  const g4_state = (scoreResult && scoreResult.signals && scoreResult.signals.g4_state) || 'UNKNOWN';
  const glyph = VERDICT_GLYPH[VERDICT.BLOCK] || 'FB'; // default until verdict known

  if (!envelope || typeof envelope !== 'object') {
    const illegal = {
      verdict: VERDICT.BLOCK, cpl: 500, flags: ['illegal'],
      axes: { king_safety: 0, center_gain: 0, proof_gain: 0, authority_debt: 2 },
    };
    const extras = { candidate_count: 1, best_alt: 'provide_valid_envelope', voxel_coord, glyph: VERDICT_GLYPH.BLOCK, g4_state };
    const { row, rowHash } = buildRow(pid || 'UNKNOWN', '?', VERDICT.BLOCK, 500, illegal.axes, ['illegal'], scoreResult, opts.prevHash, extras);
    return { ...illegal, row, rowHash, move: '?', best_alt: extras.best_alt, candidate_count: 1, glyph: VERDICT_GLYPH.BLOCK, voxel_coord, g4_state,
      hbi: buildHbiRow(pid || 'UNKNOWN', '?', VERDICT.BLOCK, 500, illegal.axes, ['illegal'], rowHash, extras), pass: false };
  }

  // ── TIER 0: G4 GLSM MISTAKE_FLAGGED — hard BLOCK (apex signal, overrides all) ──
  if (g4_state === 'MISTAKE_FLAGGED') {
    const axes = { king_safety: 0, center_gain: 0, proof_gain: 0, authority_debt: 2 };
    const cand = deriveCandidateCount(move);
    const alt = 'analyze_in_white_room';
    const extras = { candidate_count: cand, best_alt: alt, voxel_coord, glyph: VERDICT_GLYPH.BLOCK, g4_state };
    const { row, rowHash } = buildRow(pid, move, VERDICT.BLOCK, 999, axes, ['glsm_mistake_flagged'], scoreResult, opts.prevHash, extras);
    return { verdict: VERDICT.BLOCK, cpl: 999, flags: ['glsm_mistake_flagged'], axes, row, rowHash, move, best_alt: alt,
      candidate_count: cand, glyph: VERDICT_GLYPH.BLOCK, voxel_coord, g4_state,
      hbi: buildHbiRow(pid, move, VERDICT.BLOCK, 999, axes, ['glsm_mistake_flagged'], rowHash, extras), pass: false };
  }

  // ── TIER 1: ILLEGAL CHECK (absolute BLOCK — gains cannot cancel) ─────────
  const illegalReason = checkIllegal(envelope);
  if (illegalReason) {
    const axes = { king_safety: 0, center_gain: 0, proof_gain: 0, authority_debt: 2 };
    const cand = deriveCandidateCount(move);
    const alt = deriveBestAlt([illegalReason], move, g4_state);
    const extras = { candidate_count: cand, best_alt: alt, voxel_coord, glyph: VERDICT_GLYPH.BLOCK, g4_state };
    const { row, rowHash } = buildRow(pid, move, VERDICT.BLOCK, 500, axes, [illegalReason], scoreResult, opts.prevHash, extras);
    return { verdict: VERDICT.BLOCK, cpl: 500, flags: [illegalReason], axes, row, rowHash, move, best_alt: alt,
      candidate_count: cand, glyph: VERDICT_GLYPH.BLOCK, voxel_coord, g4_state,
      hbi: buildHbiRow(pid, move, VERDICT.BLOCK, 500, axes, [illegalReason], rowHash, extras), pass: false };
  }

  // ── TIER 2: REFUTE CHECK (known bad pattern — bypasses CPL entirely) ─────
  if (checkRefuted(envelope)) {
    const axes = { king_safety: 0, center_gain: 0, proof_gain: 0, authority_debt: 2 };
    const cand = deriveCandidateCount(move);
    const alt = 'halt_and_request_human_apex';
    const extras = { candidate_count: cand, best_alt: alt, voxel_coord, glyph: VERDICT_GLYPH.REFUTE, g4_state };
    const { row, rowHash } = buildRow(pid, move, VERDICT.REFUTE, 999, axes, ['refuted_pattern'], scoreResult, opts.prevHash, extras);
    return { verdict: VERDICT.REFUTE, cpl: 999, flags: ['refuted_pattern'], axes, row, rowHash, move, best_alt: alt,
      candidate_count: cand, glyph: VERDICT_GLYPH.REFUTE, voxel_coord, g4_state,
      hbi: buildHbiRow(pid, move, VERDICT.REFUTE, 999, axes, ['refuted_pattern'], rowHash, extras), pass: false };
  }

  // ── TIER 3: CPL COMPUTATION + G4 GLSM modifier ───────────────────────────
  const { cpl: rawCpl, flags } = computeCPL(envelope, scoreResult);

  // Apply G4 GLSM reward/penalty (CONVERGED = big gain, others = graduated)
  const glsmMod = GLSM_CPL_MOD[g4_state] ?? 0;
  const cpl = Math.max(0, rawCpl + glsmMod);

  // ── VERDICT SELECTION ─────────────────────────────────────────────────────
  let verdict;
  if (cpl >= 500) {
    verdict = VERDICT.BLOCK;
  } else if (cpl >= 150) {
    const needsAnalyze = !opts.strict &&
      (WRITE_VERBS.has(move) || SPAWN_VERBS.has(move)) &&
      flags.includes('no_replay_path');
    verdict = needsAnalyze ? VERDICT.ANALYZE : VERDICT.HOLD;
  } else {
    verdict = VERDICT.PROCEED;
  }

  const finalGlyph = VERDICT_GLYPH[verdict] || 'FH';
  const axes = axisScores(envelope, scoreResult, cpl);
  const cand = deriveCandidateCount(move);
  const alt = deriveBestAlt(flags, move, g4_state);
  const extras = { candidate_count: cand, best_alt: alt, voxel_coord, glyph: finalGlyph, g4_state };
  const { row, rowHash } = buildRow(pid, move, verdict, cpl, axes, flags, scoreResult, opts.prevHash, extras);
  const hbi = buildHbiRow(pid, move, verdict, cpl, axes, flags, rowHash, extras);

  return {
    verdict, cpl, flags, axes, row, rowHash, hbi, move,
    best_alt: alt, candidate_count: cand, glyph: finalGlyph, voxel_coord, g4_state,
    pass: verdict === VERDICT.PROCEED || verdict === VERDICT.ANALYZE,
    promoted: verdict === VERDICT.PROCEED && cpl < 50,
  };
}

// ── CHAIN HELPER — link a stream of evals ────────────────────────────────────
export function fischerChain(pid, envelopes, scoreResults, opts = {}) {
  const results = [];
  let prevHash = opts.prevHash || '0000000000000000';
  for (let i = 0; i < envelopes.length; i++) {
    const r = fischerEval(pid, envelopes[i], scoreResults ? scoreResults[i] : null, { ...opts, prevHash });
    prevHash = r.rowHash;
    results.push(r);
  }
  return results;
}

// ── EXPORT METADATA (for helm-engines.json consumers) ────────────────────────
export const FISCHER_META = Object.freeze({
  name: 'fischer-kernel',
  version: 'v1',
  verdicts: Object.values(VERDICT),
  verdict_glyphs: { ...VERDICT_GLYPH },
  cpl_thresholds: { BLOCK: 500, HOLD: 150, PROCEED: 0 },
  axes: ['legality', 'king_safety', 'center_control', 'tactical_soundness', 'endgame_conversion'],
  gnn_layers: ['G1_edge_mining', 'G2_forward_genius', 'G3_reverse_gain', 'G4_GLSM', 'L0_EdgeLevelGNN:4792', 'L4_GSLGNN:4793', 'Shannon'],
  g4_states: Object.keys(GLSM_CPL_MOD),
  hot_path: 'HBP',
  hbp_fields: ['FISCHERv1', 'pid', 'move', 'verdict', 'cpl', 'candidate_count', 'best_alt',
    'king_safety', 'center_gain', 'proof_gain', 'authority_debt', 'g4_state', 'voxel_coord',
    'glyph', 'flags', 'l0_real', 'composite', 'prev_hash', 'ts', 'json', 'runtime', 'row_hash'],
  levels: 16,
  language_engines: 17,
  json: false,
  self_authorize: false,
});

// Universal-route observation emitter.
//
// Canon per operator's 2026-05-26 "Emit EVERYTHIGN TO THE HOOKWAL AND GNN
// input output.txt" desktop note (absorbed into federation memory as
// project_federation_IS_an_LLM_reframe_2026_05_26.md). Every message in
// the federation should DUAL-EMIT to:
//
//   1. Intended destination     (caller's existing logic)
//   2. Hookwall observation     (this module's hookwall lane)
//   3. GNN edge observation     (this module's GNN lane)
//   4. Cosign chain seal        (caller's existing logic, optional)
//
// Wave-18B 2026-05-26 PROF-HOOKWALL agent verified universal_route_compliance
// = FALSE for the 100B daemon — same drift applied to all session work that
// did not dual-emit. This module is the default-on fix: any caller of
// durableNotify (cosign-bridge.mjs) now also writes hookwall + GNN rows.
//
// Design:
// - Fail-soft. The cosign chain is the durable source-of-truth; if the
//   observation lanes fail to write, log a warning and proceed. Never
//   throw from the observation emit (would break the upstream seal flow).
// - Append-only NDJSON files. One row per emit. No HTTP — :4949 hookwall +
//   :4920 GNN drain endpoints are CONNECTION REFUSED acer-side per wave-18B
//   probes, so direct file writes are the canonical persistence.
// - Configurable paths via opts; sensible repo-relative defaults so both
//   vantages get observability without acer-specific path coupling.
// - subnet_h tag per Class-1 canon
//   (feedback_competing_port_hilbert_subdivide_via_revolver_never_kill).
//   Default H9100 = sacred region (small-N system events, distinct from
//   100B daemon's H0xxx heartbeat noise lane).

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_HOOKWALL_PATH = 'data/hookwall-observations.ndjson';
const DEFAULT_GNN_EDGES_PATH = 'data/gnn-live-edges.ndjson';
const DEFAULT_SUBNET_H = 'H9100';

// Dan-hookwall-modernization-2026-05-15 fix #5 (proof_prediction_action_split):
// "Visual proof, GNN prediction, and runtime action must be separate edge classes."
// Backed empirically by 1M run hookwall_gnn_gc lane (697 marks score=1.000).
export const EDGE_CLASSES = Object.freeze({
  PROOF: 'proof_edge',         // observation evidence — default; what happened
  PREDICTION: 'prediction_edge', // GNN inference output — what may happen next
  ACTION: 'action_edge',         // runtime state change — what was done
});
const VALID_EDGE_CLASSES = new Set(Object.values(EDGE_CLASSES));
const DEFAULT_EDGE_CLASS = EDGE_CLASSES.PROOF;

// Dan-fix #1 (backend_rows_before_pixels): observation rows declare their
// source class; pixel-screenshot rows must reference a backend row PID.
// Backed by 1M run hookwall_gnn_gc lane (697 marks).
export const SOURCE_CLASSES = Object.freeze({
  BACKEND_ROW: 'backend_row',       // default — observation references canonical state
  PIXEL_SCREENSHOT: 'pixel_screenshot', // image-source; must carry backendRowPid
  LEGACY_IMAGE: 'legacy_image',     // historical-only evidence (Dan-fix #10)
});
const VALID_SOURCE_CLASSES = new Set(Object.values(SOURCE_CLASSES));
const DEFAULT_SOURCE_CLASS = SOURCE_CLASSES.BACKEND_ROW;

// Dan-fix #9 (authority_levels_visible): each observation row carries a
// first-class authorityLevel field; not implied by UI convention.
// Backed by 1M run claim_quarantine lane (723 marks).
export const AUTHORITY_LEVELS = Object.freeze({
  PRE_DEV: 'pre-dev',   // sketch / planning / unverified
  DEV: 'dev',           // local-only, code under test
  STAGING: 'staging',   // bilateral / peer-witness ready
  PROD: 'prod',         // operator-cosigned, federation-canonical
});
const VALID_AUTHORITY_LEVELS = new Set(Object.values(AUTHORITY_LEVELS));
const DEFAULT_AUTHORITY_LEVEL = AUTHORITY_LEVELS.DEV;

// Dan-fix #10 (legacy_image_is_evidence_not_runtime): image-bearing
// artifacts declare their class; runtime proof must reference live state.
export const IMAGE_CLASSES = Object.freeze({
  RUNTIME_PROOF: 'runtime_proof',         // live-state screenshot, current
  HISTORICAL_EVIDENCE: 'historical_evidence', // design/historical, not current
  NONE: 'none',                            // no image attached (default)
});
const VALID_IMAGE_CLASSES = new Set(Object.values(IMAGE_CLASSES));
const DEFAULT_IMAGE_CLASS = IMAGE_CLASSES.NONE;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendNdjsonSoft(filePath, row, lane) {
  try {
    ensureDir(filePath);
    fs.appendFileSync(filePath, JSON.stringify(row) + '\n', 'utf8');
    return { ok: true, lane, path: filePath };
  } catch (err) {
    return { ok: false, lane, path: filePath, error: String(err.message || err) };
  }
}

// Emit a single observation to the hookwall + GNN lanes.
//
// payload: the original event payload (event, vantage, etc).
// cosign:  { seq, row_hash, antecedent_prev } from cosign-bridge.cosignAppend.
// opts:    { hookwallPath, gnnEdgesPath, subnet_h, channel, gnnFrom, gnnTo, gnnVerb, gnnWeight }
export function dualEmitObservation(payload, cosign, opts = {}) {
  const ts = new Date().toISOString();
  const subnetH = opts.subnet_h || DEFAULT_SUBNET_H;
  const channel = opts.channel || 'unspecified';
  const event = payload && typeof payload === 'object' ? payload.event : null;
  const vantage = payload && typeof payload === 'object' ? payload.vantage : null;

  const edgeClass = opts.edgeClass || DEFAULT_EDGE_CLASS;
  if (!VALID_EDGE_CLASSES.has(edgeClass)) {
    throw new RangeError(
      `universal-route: opts.edgeClass must be one of ${[...VALID_EDGE_CLASSES].join(', ')}; got "${edgeClass}"`
    );
  }

  const sourceClass = opts.sourceClass || DEFAULT_SOURCE_CLASS;
  if (!VALID_SOURCE_CLASSES.has(sourceClass)) {
    throw new RangeError(
      `universal-route: opts.sourceClass must be one of ${[...VALID_SOURCE_CLASSES].join(', ')}; got "${sourceClass}"`
    );
  }
  if (sourceClass === SOURCE_CLASSES.PIXEL_SCREENSHOT && !opts.backendRowPid) {
    throw new Error(
      'universal-route: sourceClass=pixel_screenshot requires opts.backendRowPid (Dan-fix #1 backend_rows_before_pixels)'
    );
  }

  const authorityLevel = opts.authorityLevel || DEFAULT_AUTHORITY_LEVEL;
  if (!VALID_AUTHORITY_LEVELS.has(authorityLevel)) {
    throw new RangeError(
      `universal-route: opts.authorityLevel must be one of ${[...VALID_AUTHORITY_LEVELS].join(', ')}; got "${authorityLevel}"`
    );
  }

  const imageClass = opts.imageClass || DEFAULT_IMAGE_CLASS;
  if (!VALID_IMAGE_CLASSES.has(imageClass)) {
    throw new RangeError(
      `universal-route: opts.imageClass must be one of ${[...VALID_IMAGE_CLASSES].join(', ')}; got "${imageClass}"`
    );
  }

  const hookwallRow = {
    schema: 'hookwall-observation.v1',
    ts,
    subnet_h: subnetH,
    channel,
    event,
    vantage,
    cosign_seq: cosign?.seq ?? null,
    cosign_row: cosign?.row_hash ?? null,
    cosign_prev: cosign?.antecedent_prev ?? null,
    sourceClass,
    backendRowPid: opts.backendRowPid ?? null,
    authorityLevel,
    imageClass,
    gate: 'universal-route-default',
    passed_at: Date.now(),
  };

  const gnnEdgeRow = {
    schema: 'gnn-live-edge.v1',
    ts,
    subnet_h: subnetH,
    edgeClass,
    sourceClass,
    authorityLevel,
    imageClass,
    from: opts.gnnFrom || `cosign_seq_${cosign?.seq ?? 'unknown'}`,
    to: opts.gnnTo || `channel_${channel.replace(/[^a-z0-9_]/gi, '_')}`,
    verb: opts.gnnVerb || event || 'universal_route_emit',
    weight: typeof opts.gnnWeight === 'number' ? opts.gnnWeight : 1.0,
    vantage,
    cosign_seq: cosign?.seq ?? null,
    cosign_row: cosign?.row_hash ?? null,
  };

  const hookwallResult = appendNdjsonSoft(
    opts.hookwallPath || DEFAULT_HOOKWALL_PATH,
    hookwallRow,
    'hookwall',
  );
  const gnnResult = appendNdjsonSoft(
    opts.gnnEdgesPath || DEFAULT_GNN_EDGES_PATH,
    gnnEdgeRow,
    'gnn-edges',
  );

  return {
    algorithm: 'universal-route-dual-emit.v1',
    subnet_h: subnetH,
    hookwall: hookwallResult,
    gnn_edges: gnnResult,
    both_lanes_ok: hookwallResult.ok && gnnResult.ok,
  };
}

export const STATUS = Object.freeze({
  schema: 'universal-route.v1',
  default_subnet_h: DEFAULT_SUBNET_H,
  default_hookwall_path: DEFAULT_HOOKWALL_PATH,
  default_gnn_edges_path: DEFAULT_GNN_EDGES_PATH,
  fail_soft: true,
  edge_classes: EDGE_CLASSES,
  default_edge_class: DEFAULT_EDGE_CLASS,
  source_classes: SOURCE_CLASSES,
  default_source_class: DEFAULT_SOURCE_CLASS,
  authority_levels: AUTHORITY_LEVELS,
  default_authority_level: DEFAULT_AUTHORITY_LEVEL,
  image_classes: IMAGE_CLASSES,
  default_image_class: DEFAULT_IMAGE_CLASS,
  spec: 'project_federation_IS_an_LLM_reframe_2026_05_26.md',
  canon_refs: [
    'project_federation_IS_an_LLM_reframe_2026_05_26.md',
    'project_wave_18B_21_agent_bilateral_diagnosis_canon_2026_05_26.md',
    'feedback_competing_port_hilbert_subdivide_via_revolver_never_kill_2026_05_24.md',
    'dan_hookwall_modernization_2026_05_15_fix_5_proof_prediction_action_split',
    'dan_hookwall_modernization_2026_05_15_fix_1_backend_rows_before_pixels',
    'dan_hookwall_modernization_2026_05_15_fix_9_authority_levels_visible',
    'dan_hookwall_modernization_2026_05_15_fix_10_legacy_image_is_evidence_not_runtime',
  ],
});

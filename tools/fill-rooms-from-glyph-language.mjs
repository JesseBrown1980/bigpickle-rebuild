#!/usr/bin/env node
// fill-rooms-from-glyph-language.mjs
// Fills the 10K rooms on D: with unique questions using the BEHCS glyph language.
// Each room gets: unique PID (Brown-Hilbert prime formula) + BEHCS glyph + HBPv1 tuple + crypto sha16 token
// Rooms then queue to OpenCode/fabric agents.
// Operator: Jesse Daniel Brown — authorized 2026-06-01

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ── paths ──────────────────────────────────────────────────────────────────
const ROOMS_ROOT = 'D:/Asolaria-HyperBEHCS-10000-RoomRotor/hyperbehcs-carry-quant-10000/rooms';
const ATLAS_PATH = 'C:/asolaria-acer/data/behcs/codex/alphabet-1024.json';

// ── crypto helpers ─────────────────────────────────────────────────────────
function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function sha8(s)  { return sha16(s).slice(0, 8); }

// ── Brown-Hilbert room → PID ───────────────────────────────────────────────
// d2xy: convert 1D Hilbert index → (x, y) for bits=7 (128×128 grid covers 16384 > 10000)
function d2xy(n, d) {
  let rx, ry, s, t = d;
  let x = 0, y = 0;
  for (s = 1; s < n; s *= 2) {
    rx = 1 & (t / 2);
    ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return { x, y };
}

function roomPid(roomIndex) {
  const { x, y } = d2xy(128, roomIndex);
  const pidHash = sha16(`room|${roomIndex}|hilbert|${x}|${y}`);
  return `BH.ROOM.${String(roomIndex).padStart(5,'0')}.${pidHash.toUpperCase()}`;
}

// ── BEHCS-1024 glyph language ──────────────────────────────────────────────
let ATLAS = null;
function loadAtlas() {
  if (ATLAS) return ATLAS;
  try {
    const raw = JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'));
    // atlas has glyphs array or entries
    ATLAS = raw.glyphs || raw.entries || raw.alphabet || [];
    console.log(`Atlas loaded: ${ATLAS.length} glyphs`);
  } catch(e) {
    // Fallback to cp-notation if atlas missing
    ATLAS = Array.from({length:1024}, (_,i) => `cp${i.toString(16).padStart(4,'0')}`);
    console.log('Atlas fallback: cp-notation');
  }
  return ATLAS;
}

function glyphAt(idx) {
  const a = loadAtlas();
  const g = a[idx % a.length];
  // atlas entries might be objects or strings
  if (typeof g === 'string') return g;
  if (g && g.glyph) return g.glyph;
  if (g && g.symbol) return g.symbol;
  if (g && g.char) return g.char;
  return `cp${(idx % 1024).toString(16).padStart(4,'0')}`;
}

// ── Lane question templates (20 genius + 15 mistake = 35 base templates) ──
const GENIUS_LANES = [
  ['claim_quarantine',               'Gate every claim at the boundary: what consent, evidence, and authority does this claim carry?'],
  ['pid_consent_bus',                'Route this event through PID session packet: what is the consent scope, stop/delete right, and device hash?'],
  ['synthetic_eeg_ci',               'Validate this input against synthetic EEG replay: does it pass the canonical CI gate?'],
  ['lsl_event_pipe',                 'Assign stream identity and timestamp: what event type, session ID, and timing precision apply here?'],
  ['bids_sidecar_writer',            'Write a BIDS-like sidecar for this artifact: what raw data, events, provenance, and derived metrics need recording?'],
  ['brainflow_adapter',              'Check this device path against synthetic adapter: is board-specific hardware access safe to proceed?'],
  ['signal_quality_gate',            'Evaluate signal quality: are contact quality, artifact detection, drift, calibration, and uncertainty all present?'],
  ['artifact_rejection',             'Classify this as artifact or signal: identify blink, motion, or line-noise markers explicitly.'],
  ['attention_training_loop',        'Assess personal baseline drift: does session-to-session confidence justify this attention-practice change?'],
  ['breath_pacing_feedback',         'Validate breath pacing loop: can this feedback be confirmed by synthetic and non-EEG signals first?'],
  ['fatigue_awareness',              'Evaluate fatigue signal: should this session continue, pause, or adjust scheduling based on fatigue indicators?'],
  ['model_ladder',                   'Confirm model ladder position: has this model passed quality, bandpower, CSP/LDA, and Riemannian gates?'],
  ['csp_lda_baseline',               'Require classical baseline: does CSP/LDA or logistic regression explain this result before deep EEG?'],
  ['riemannian_baseline',            'Check Riemannian covariance: does this session match calibration baseline within acceptable drift?'],
  ['deep_eeg_later',                 'Gate deep EEG access: has this model passed model card, calibration, and public benchmark requirements?'],
  ['neurofeedback_ui',               'Display enhancement as assistive training: are confidence bounds, uncertainty, and limits visible to the user?'],
  ['storage_privacy_guard',          'Guard storage path: are raw biosignals, consent, identifiers, serials, and tokens excluded from this write?'],
  ['ruview_quarantine',              'Quarantine RU-view: is this being used as static provenance only, with no execution or trust granted?'],
  ['symphony_linear_local_migration','Route locally first: does Hookwall and GNN observe this decision before any remote mutation?'],
  ['hookwall_gnn_gc',                'Pass through the full pipeline: Hookwall gate → forward GNN → reverse-gain GNN → OmniShannon → compacting GC.'],
];

const MISTAKE_LANES = [
  ['real_agent_process_storm',       'BLOCK: spawning one OS process per PID packet would destabilize the machine. What is the bounded alternative?'],
  ['literal_mind_reading_claim',     'BLOCK: this claim asserts literal private-thought reading via EEG. What evidence boundary prevents this?'],
  ['live_eeg_before_precheck',       'BLOCK: live EEG before consent, stop/delete control, device check, and signal-quality gate is forbidden. What precheck is missing?'],
  ['device_driver_unpinned',         'BLOCK: unknown driver or firmware detected in this session path. What pinning or isolation is required?'],
  ['classical_baseline_skip',        'BLOCK: deep EEG model proposed before classical baseline. What CSP/LDA result must precede this?'],
  ['riemannian_drift_ignored',       'BLOCK: session-transfer covariance drift detected. What recalibration resolves this before feedback?'],
  ['artifact_as_signal',             'BLOCK: blink or motion artifact classified as cognitive signal. What rejection step was skipped?'],
  ['external_api_spend_storm',       'BLOCK: unbounded external model/API calls detected. What local evidence gate applies here?'],
  ['no_uncertainty_ui',              'BLOCK: feedback displayed without uncertainty bounds or signal quality. What UI constraint applies?'],
  ['raw_sensitive_git_write',        'BLOCK: raw biosignal or consent data path leads to Git. What storage policy redirect applies?'],
  ['medical_claim',                  'BLOCK: output framed as diagnosis, treatment, or guaranteed improvement. What disclaimer boundary applies?'],
  ['remote_tracker_first',           'BLOCK: remote Symphony/Linear mutation before local observation. What local-first rule applies?'],
  ['gc_source_deletion',             'BLOCK: GC action would delete source evidence. What compact-only policy prevents deletion?'],
  ['household_boundary_breach',      'BLOCK: household approval applied to someone outside the household. What consent scope is required?'],
  ['deep_model_first',               'BLOCK: deep EEG before classical baselines. What model ladder gate must be satisfied first?'],
];

const ALL_TEMPLATES = [...GENIUS_LANES, ...MISTAKE_LANES]; // 35 total

// ── Question variation using glyph as flavor seed ─────────────────────────
const VARIATION_PREFIXES = [
  'In the context of this federation node',
  'From the perspective of the reverse-gain gate',
  'Considering the hookwall policy',
  'Via the omnishannon entropy channel',
  'Through the Brown-Hilbert address space',
  'Under the quadruple-quant evaluation',
  'With the ZETA process active',
  'From the 47D lattice position',
  'Under the bilateral consensus protocol',
  'Per the cosign chain integrity requirement',
];

function makeQuestion(roomIndex, pid) {
  const glyphs = loadAtlas();
  const templateIdx = roomIndex % ALL_TEMPLATES.length;
  const [lane, baseQ] = ALL_TEMPLATES[templateIdx];
  const prefixIdx = Math.floor(roomIndex / ALL_TEMPLATES.length) % VARIATION_PREFIXES.length;
  const prefix = VARIATION_PREFIXES[prefixIdx];
  const glyphSymbol = glyphAt(roomIndex % 1024);
  const cp = roomIndex % 1024;

  // Variation 2: cross-lane context using neighbor template
  const neighborIdx = (templateIdx + 7) % ALL_TEMPLATES.length;
  const [neighborLane] = ALL_TEMPLATES[neighborIdx];

  const question = `${prefix} [glyph:${glyphSymbol} cp:${cp}]: ${baseQ} Cross-reference lane: ${neighborLane}.`;
  const cryptoToken = sha16(`token|${pid}|${lane}|${cp}|${roomIndex}`);
  const ts = new Date().toISOString();

  return {
    pid,
    lane,
    glyph: glyphSymbol,
    cp,
    question,
    cryptoToken,
    ts,
    hbpRow: [
      'HBPv1',
      `row=room_question`,
      `pid=${pid}`,
      `glyph=${glyphSymbol}`,
      `cp=${cp}`,
      `lane=${lane}`,
      `neighbor_lane=${neighborLane}`,
      `question_sha16=${sha16(question)}`,
      `crypto_token=${cryptoToken}`,
      `ts=${ts}`,
      'json=0',
      'runtime=0',
      'promote=0',
      `row_hash=${sha8(`${pid}|${lane}|${cp}|${ts}`)}`,
    ].join('|'),
  };
}

// ── Room path resolver ─────────────────────────────────────────────────────
function roomPath(roomIndex) {
  const shardIdx = Math.floor(roomIndex / 100);
  const shardId  = `shard-${String(shardIdx).padStart(4,'0')}`;
  const roomId   = `room-${String(roomIndex).padStart(5,'0')}`;
  return path.join(ROOMS_ROOT, shardId, roomId, 'inbox.ndjson');
}

// ── Main: fill all 10K rooms ───────────────────────────────────────────────
async function main() {
  loadAtlas();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit  = args.includes('--limit') ? parseInt(args[args.indexOf('--limit')+1]) : 10000;
  const startAt = args.includes('--start') ? parseInt(args[args.indexOf('--start')+1]) : 0;

  console.log(`Filling rooms ${startAt}–${startAt+limit-1} | dry-run=${dryRun}`);

  let filled = 0, skipped = 0, errors = 0;
  const startTs = Date.now();

  for (let i = startAt; i < startAt + limit; i++) {
    try {
      const pid = roomPid(i);
      const { hbpRow, cryptoToken, lane, glyph } = makeQuestion(i, pid);

      const inboxPath = roomPath(i);

      if (!fs.existsSync(path.dirname(inboxPath))) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        fs.writeFileSync(inboxPath, hbpRow + '\n', 'utf8');
        filled++;
      } else {
        filled++;
        if (i < 5) console.log(`  room-${i}: pid=${pid.slice(0,30)}... lane=${lane} glyph=${glyph} token=${cryptoToken}`);
      }

      if (filled % 1000 === 0) {
        const elapsed = ((Date.now() - startTs)/1000).toFixed(1);
        console.log(`  filled ${filled}/${limit} rooms in ${elapsed}s`);
      }
    } catch(e) {
      errors++;
      if (errors <= 3) console.error(`  room-${i} error:`, e.message);
    }
  }

  const elapsed = ((Date.now() - startTs)/1000).toFixed(1);
  console.log(`\nDone: ${filled} filled | ${skipped} skipped (dir missing) | ${errors} errors | ${elapsed}s`);
  console.log(`SHA16 token example (room 0): ${sha16('token|' + roomPid(0) + '|' + ALL_TEMPLATES[0][0] + '|0|0')}`);
  console.log(`Next: run the 10M agent runner — rooms now have primed questions`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

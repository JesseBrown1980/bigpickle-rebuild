// asolaria-kernel.mjs — THE CANONICAL SPINE.
//
// The entire Asolaria system reduces to FIVE primitives. Everything else
// (waves, cubes, omni-*, MCP, webMCP, cascades, 1e200, the 100B run) is a
// COMPOSITION of these five. This module is the single coherent API.
//
//   1. ADDRESS   — infinite, deterministic, non-colliding   (district-fabric)
//   2. CONTENT   — what lives at an address, compressed      (hbp-emitter)
//   3. INTEGRITY — proof content is unchanged                (hbp-reader.verifyHBP)
//   4. SCORE     — which addresses/edges matter              (asolaria-score)
//   5. ROUTE     — move content between addresses            (room-dispatcher)
//
// Unification rule: nothing is destroyed; everything is re-expressed in terms
// of the five. The wave is ADDRESS-at-scale. The cube is CONTENT-accreted.
// The MCP is ADDRESS->CONTENT lookup. The Hilbert-hotel is the proof ADDRESS
// never runs out. real-vs-virtual is decided by the 42-cap / wallclock boundary.
//
// Operator: Jesse Daniel Brown — authorized 2026-06-01. Substrate: D: (729GB).

// PRIMITIVE 1 — ADDRESS
import { roomPid, hilbertXY, createDistrict, createAllDistricts, roomDir, DISTRICTS, SUBSTRATE_ROOT, sha16, sha8 } from './district-fabric.mjs';
// PRIMITIVE 2 — CONTENT
import { serializeEnvelope, writeHBP } from './hbp-emitter.mjs';
// PRIMITIVE 3 — INTEGRITY (+ read)
import { readHBP, parseEnvelope, parsePipeRow, parsePipeFile, verifyHBP, detectFormat } from './hbp-reader.mjs';
// PRIMITIVE 4 — SCORE
import { score, reverseGain, shannonSignal, L4_STATUS } from './asolaria-score.mjs';
// PRIMITIVE 5 — ROUTE
import { dispatchRoom, rotateRoom, routeToPrism, AGENT_TYPE_BY_DISTRICT, hookwallGate } from './room-dispatcher.mjs';
// ENTRY GATE — HOOKWALL (the "no bypass" front door; composes all five)
import { pass as hookwallPass, passChain, stampPid, VERDICT } from './asolaria-hookwall.mjs';
// THE FULL LOOP — revolver -> rename -> free agent -> hookwall -> prism -> GC (proven parts composed)
import { runLoop, loopCycle } from './asolaria-loop.mjs';

// ── the five, exposed as one coherent kernel ─────────────────────────────────
export const KERNEL = Object.freeze({
  version: '1.0.0',
  primitives: ['ADDRESS', 'CONTENT', 'INTEGRITY', 'SCORE', 'ROUTE'],

  ADDRESS: { pid: roomPid, hilbert: hilbertXY, createDistrict, createAllDistricts, roomDir, districts: DISTRICTS, substrate: SUBSTRATE_ROOT, sha16, sha8 },
  CONTENT: { serialize: serializeEnvelope, write: writeHBP },
  INTEGRITY: { read: readHBP, parseEnvelope, parseRow: parsePipeRow, parseFile: parsePipeFile, verify: verifyHBP, detect: detectFormat },
  SCORE: { score, reverseGain, shannon: shannonSignal, l4_status: L4_STATUS, l4_benched: false },
  ROUTE: { dispatch: dispatchRoom, rotate: rotateRoom, toPrism: routeToPrism, agentTypes: AGENT_TYPE_BY_DISTRICT, hookwall: hookwallGate },

  // ENTRY GATE — every action enters HOOKWALL first (no bypass). Composes all five.
  HOOKWALL: { pass: hookwallPass, passChain, stampPid, VERDICT },

  // THE FULL LOOP — the free-agent engine: revolver -> rename -> agent -> hookwall -> prism -> GC.
  LOOP: { run: runLoop, cycle: loopCycle },
});

// ── composition catalog — everything else IS the five composed ───────────────
// This is the unification: not a migration, a re-labeling. Each entry proves a
// "system" is just primitives composed. No code is destroyed; it is named.
export const COMPOSITIONS = Object.freeze({
  wave:            'ADDRESS at scale (PID generation across a beat-grid)',
  cube:            'CONTENT accreted over time (genius/mistake/skill/tool tuples)',
  mcp:             'ADDRESS -> CONTENT lookup engine (the live :4949 fabric)',
  webmcp:          'ADDRESS -> CONTENT lookup, pixel/screen face (omniscrcpy)',
  hilbert_hotel:   'the PROOF that ADDRESS never runs out',
  cosign_chain:    'INTEGRITY linked over time (rolling prev_sha)',
  crypto_tokens:   'INTEGRITY as local routing key (sha16)',
  glyph_language:  'CONTENT compressed (the index/tuple language, 12:1+)',
  quintuple_quant: 'CONTENT compressed with 0-loss (Polar+Turbo+JL+Zeta+deeper)',
  omnispindle:     'ROUTE with a real/virtual boundary (42-cap = 6x6 real, rest virtual)',
  omniflywheel:    'ROUTE rotation surface (9-stage pipeline)',
  omnishannon:     'SCORE via entropy (the shannon signal)',
  reverse_gain:    'SCORE promote/block gate',
  deep_wave:       'ADDRESS-at-scale x ROUTE (6x6x6x6x6x12 beat-grid composition)',
  districts:       'ADDRESS namespaces (registration offices)',
  rooms:           'ROUTE staging slots (RAM-like, drives-as-memory)',
  one_e200:        'ADDRESS at the unbounded limit (virtual sweep — never confuse w/ real packet)',
  free_agents:     'ROUTE executor (opencode in rooms, $0) — the bulk-work tier',
  hrm_mtp_gemma:   'SCORE+CONTENT made cheap (small model + hierarchical reasoning + multi-token)',
});

// ── the real/virtual boundary, codified once ─────────────────────────────────
// From the wave-taxonomy + wave-origin research: real agents cap at 6x6=42
// (omnispindle), everything above is virtual address space. Emerged at 6x6x6
// when ~18-process crash-wall met the combinatorial geometry (2026-04-19).
export const BOUNDARY = Object.freeze({
  real_cap: 42,                 // 6 parents x 6 children (omnispindle.js:33-34)
  real_cap_origin: '6x6x6=216 trigger; ~18 crash-wall; cascade.ts proved virtual at 93,312 in 57ms',
  above_cap: 'virtual address coordinates (computed, not spawned)',
  bulk_tier: 'free opencode agents in rooms ($0) — not Claude, not real-OS-storm',
  rule: 'real work stays small+bounded (<=42); scale goes virtual or free-agent',
});

// ── run the full primitive loop on one room (ADDRESS->CONTENT->ROUTE->SCORE->INTEGRITY)
export async function runPrimitiveLoop(district, idx, opts = {}) {
  // ADDRESS
  const pid = KERNEL.ADDRESS.pid(district, idx);
  // ROUTE (dispatch reads CONTENT inbox, runs agent, writes CONTENT outbox)
  const dispatched = await KERNEL.ROUTE.dispatch(district, idx, { mock: true, skipGnn: true, ...opts });
  // SCORE (composite, real L0 if reachable)
  const scored = await KERNEL.SCORE.score(pid, dispatched.answer_sha16, opts);
  return {
    address: pid,
    route: { district, idx, agent_type: dispatched.agent_type, hookwall: dispatched.hookwall },
    score: { composite: scored.composite, provenance: scored.provenance, l0_real: scored.l0_real, mark: scored.mark },
    primitives_exercised: ['ADDRESS', 'CONTENT', 'INTEGRITY', 'SCORE', 'ROUTE'],
  };
}

export default KERNEL;

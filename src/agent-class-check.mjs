// Agent-class check — distinguish real-agent (receipt-gated) from
// virtual-pointer-agent (no spawn, pointer-only exchange).
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #6 (real_agent_vs_virtual_pointer_agent):
// "Virtual agents exchange pointer receipts; real helper agents start only
// when a receipt-gated task needs them."
//
// Backed by canonical mistake mark `real_agent_storm` RG=0.999 (HARD BLOCK).
//
// Pure function. Returns classification only; caller decides dispatch.

export const AGENT_CLASSES = Object.freeze({
  VIRTUAL_POINTER: 'virtual_pointer_agent', // pointer-receipt exchange only
  REAL_HELPER: 'real_helper_agent',         // receipt-gated, may spawn child process
  AMBIGUOUS: 'ambiguous',                   // missing required fields — block
});

// classifyAgent inspects a context and returns its class.
//
// args:
//   ctx: { hasReceipt?: bool, plannedOsSpawns?: number, taskId?: string }
//
// returns: { agentClass, reason, blockedReason? }
//
// Rules:
//   - plannedOsSpawns > 0 AND !hasReceipt → AMBIGUOUS + blocked (matches real_agent_storm guard)
//   - plannedOsSpawns > 0 AND hasReceipt → REAL_HELPER (legitimate receipt-gated spawn)
//   - plannedOsSpawns === 0 → VIRTUAL_POINTER (default safe path)
export function classifyAgent(ctx = {}) {
  const planned = typeof ctx.plannedOsSpawns === 'number' ? ctx.plannedOsSpawns : 0;
  const hasReceipt = Boolean(ctx.hasReceipt);

  if (planned > 0 && !hasReceipt) {
    return {
      agentClass: AGENT_CLASSES.AMBIGUOUS,
      reason: 'planned_os_spawns_without_receipt',
      blockedReason: 'real_agent_storm_guard_RG_0.999_blocks_unreceipted_real_spawns',
    };
  }
  if (planned > 0 && hasReceipt) {
    return {
      agentClass: AGENT_CLASSES.REAL_HELPER,
      reason: 'planned_os_spawns_with_receipt',
    };
  }
  return {
    agentClass: AGENT_CLASSES.VIRTUAL_POINTER,
    reason: 'no_os_spawns_planned_pointer_receipt_only',
  };
}

// isStormRisk: convenience check — returns true if classification blocks dispatch.
export function isStormRisk(ctx = {}) {
  return classifyAgent(ctx).agentClass === AGENT_CLASSES.AMBIGUOUS;
}

export const STATUS = Object.freeze({
  schema: 'agent-class-check.v1',
  classes: AGENT_CLASSES,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_6_real_agent_vs_virtual_pointer_agent',
  guards: 'real_agent_storm_RG_0.999_canonical_mistake_mark',
});

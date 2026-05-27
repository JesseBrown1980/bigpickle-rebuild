// Runtime tool gate — receipt-required for runtime-class tool calls.
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #7 (receipt_before_tool_use):
// "Helpers may use descriptor tools now; runtime MCP/provider/control tools
// wait for connector receipts and authority."
//
// Pure-function middleware. Caller passes (toolName, ctx) → gate returns
// { allowed, reason } or { allowed: false, blockedReason }. Caller dispatches.

export const TOOL_CLASSES = Object.freeze({
  DESCRIPTOR: 'descriptor',     // read-only / metadata only — no receipt needed
  RUNTIME: 'runtime',           // mutates state — receipt required
  PROVIDER: 'provider',         // external LLM/API — receipt required
  CONTROL: 'control',           // process spawn / kill — receipt + operator authority required
});

const RUNTIME_CLASS_SET = new Set([
  TOOL_CLASSES.RUNTIME,
  TOOL_CLASSES.PROVIDER,
  TOOL_CLASSES.CONTROL,
]);

// gateRuntimeTool decides whether a tool invocation may proceed.
//
// args:
//   toolName: identifier string (for error messages + ledger)
//   toolClass: ∈ TOOL_CLASSES (default 'runtime' — safe-fail strict)
//   ctx: { hasReceipt?: bool, authorityLevel?: string }
//
// returns: { allowed, reason } OR { allowed: false, blockedReason }
export function gateRuntimeTool(toolName, toolClass = TOOL_CLASSES.RUNTIME, ctx = {}) {
  if (typeof toolName !== 'string' || toolName.length === 0) {
    return { allowed: false, blockedReason: 'gate: toolName must be a non-empty string' };
  }
  if (!Object.values(TOOL_CLASSES).includes(toolClass)) {
    return { allowed: false, blockedReason: `gate: unknown toolClass "${toolClass}"` };
  }
  if (toolClass === TOOL_CLASSES.DESCRIPTOR) {
    return { allowed: true, reason: 'descriptor_class_no_gate_required' };
  }
  // Runtime-tier classes require receipt
  if (!ctx.hasReceipt) {
    return {
      allowed: false,
      blockedReason: `runtime_tool_${toolName}_blocked_no_receipt_per_Dan_fix_7_receipt_before_tool_use`,
    };
  }
  // Control class additionally requires explicit operator authority
  if (toolClass === TOOL_CLASSES.CONTROL && ctx.authorityLevel !== 'prod') {
    return {
      allowed: false,
      blockedReason: `control_tool_${toolName}_requires_authorityLevel_prod_got_${ctx.authorityLevel ?? 'unset'}`,
    };
  }
  return { allowed: true, reason: `${toolClass}_class_receipt_present_authorityLevel_${ctx.authorityLevel ?? 'unset'}` };
}

export const STATUS = Object.freeze({
  schema: 'runtime-tool-gate.v1',
  tool_classes: TOOL_CLASSES,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_7_receipt_before_tool_use',
  composes_with: 'src/agent-class-check.mjs (Dan-fix #6)',
});

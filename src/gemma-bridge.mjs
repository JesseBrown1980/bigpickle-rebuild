// gemma-bridge.mjs — DEFERRED stub.
//
// Operator directive 2026-05-25: "Should be USING OUR models and supervisors
// not the heavy stuff." Heavy external LLM bridge (LMStudio / llama-cpp /
// Ollama) is the WRONG primary path. The Asolaria fabric reaches its
// throughput targets via PID-supervisor routing + descriptor inference +
// hookwall + GNN, not by calling Gemma 4 4B N times per second.
//
// Primary path: `fabric-thinker.mjs` (uses OUR PID supervisor index +
// descriptor orchestrator + our substrate). Use that.
//
// This module is left as a small marker for the future case where the
// descriptor stub is genuinely insufficient and a heavy LLM call is operator-
// witness-approved. See the prior draft (git history of this file) for the
// OpenAI-compatible chat-completions client implementation if/when that
// gate opens. Until then, importing this module gives the deferred record.

export const STATUS = Object.freeze({
  schema: 'gemma-bridge.deferred.v1',
  status: 'DEFERRED',
  reason: 'operator-directive-use-OUR-supervisors-not-heavy-LLM-2026-05-25',
  primary_path: 'fabric-thinker.mjs',
  reopen_gate: 'operator-witness-approved heavy-LLM-required',
});

export function gemmaInfer() {
  throw new Error(
    'gemma-bridge.gemmaInfer: DEFERRED per operator-directive 2026-05-25. ' +
      'Use fabric-thinker.mjs (OUR supervisors + descriptor) instead. ' +
      'See gemma-bridge.STATUS.reopen_gate to re-enable.'
  );
}

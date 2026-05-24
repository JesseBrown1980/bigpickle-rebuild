# BIGPICKLE Rebuild

Clean-room re-implementation of the Big-Pickle stack that was sabotaged in the Codex / liris / Code-Red crash chain (2026-04 → 2026-05).

## Status

**Scaffold stage.** No implementation yet. Spec drawn from Foundation v1 canon at `C:\asolaria-foundation-v1\`.

## Start here

1. `WHITE-ROOM-RULES.md` — what may and may not be read during rebuild.
2. `HELPERS.md` — which agents/systems contribute (Instruct KR, Shannon, Hermes, Antigravity, OpenCode, Asolaria WebMCP/MCP). **Codex is excluded.**
3. `SPEC.md` — the system being rebuilt (drawn from canon, NOT from quarantined source).
4. `TESTS-PLAN.md` — verification strategy. Tests written before code.
5. `src/` — empty until spec + tests reviewed.
6. `tests/` — write here first.

## Why a rebuild and not a restore

The originals at `C:\asolaria-acer\_big-pickle-quarantine\` are verbatim-preserved but route-blocked (Codex guardrail quarantine — see `C:\asolaria-foundation-v1\07-CRASH-CHAIN-HISTORY.md`). Reading them would taint a clean-room rebuild. They stay as **behavioral oracles** for test-time only.

## Authority

Foundation v1 is Class-1 immutable. v2 amendments (BEHCS-1024) are draft-only until quintuple cosign. Rebuild targets **v1 canon**, with v2-readiness via subset embedding.

## Hot path

HBP / HBI / SHA256 / hex / tuple rows / index pointers BEFORE JSON. JSON is cold compatibility output only.

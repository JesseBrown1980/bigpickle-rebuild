# BIGPICKLE Rebuild

Clean-room re-implementation of the Big-Pickle stack that was sabotaged in the Codex / liris / Code-Red crash chain (2026-04 → 2026-05).

## Status

**v0.1.0 baseline shipped.** 126 tests / 125 pass / 1 env-skip / 0 fail (Node 20 + 22). Layer 7 (helm supervisor) added 2026-05-24. See `npm run helm:info`.

Spec drawn from Foundation v1 canon at `C:\asolaria-foundation-v1\`.

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

## Helm supervisor (layer 7)

Long-running node process that watches a queue, processes jobs through the full canonical envelope cycle (PID mint → 47D tuple → hookwall → worker spawn → HBP sidecar trinity → GNN edge → receipt), and defers gate-protected ops (`daemon-start`, USB writes, MEMORY.md writes, `cp-mint`) to operator-witness or apex authority. Multi-drive aware — engines may live on any drive or be HTTP URLs (see `helm-engines.json`).

```bash
npm run helm:info          # show drives, queue, engine registry
npm run helm:tick          # process one job from in/
npm run helm:start         # forever-loop (Ctrl+C to stop)
```

Default queue: `D:/Asolaria-External/helm/queue/{in,done,failed,out,hbp}/`. Drop a job manifest into `in/`:

```json
{"verb":"sanity-check","prompt":"hello","workdir":"D:/bigpickle-rebuild"}
```

Worker backends:
- `mock` (default) — predictable echo; used by tests + dry runs
- `claude-cli` — spawns `claude --print --output-format json` (subscription credits or `ANTHROPIC_API_KEY` required; not env-validated for CI)
- `http-proxy` — POST to a configured URL (future :4951 asolaria-bridge wiring)

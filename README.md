# BIGPICKLE Rebuild

Clean-room re-implementation of the Big-Pickle stack that was sabotaged in the Codex / liris / Code-Red crash chain (2026-04 → 2026-05).

## Status

**Layer 8 (fabric integration) shipped 2026-05-24.** Full suite 139 tests / 126 pass / 13 skip / 0 fail (Node 20 + 22). Helm-supervisor citizen `AGT-L3-HELM-CLAUDE-SUP-H8EF7-W113-P00-N17f0cc4c` is registered in the live Asolaria fabric (acer-side `.hbp` ledger + sidecar trinity + voxel + heartbeat tick). Bilateral closure with liris-Claude confirmed: D15 cohort admission cell written + canon-index entry live (333 entries) + pipe `:4920→:4922→:4924` HEALTHY end-to-end.

**Layer 7 baseline:** Helm supervisor module — PR #8 merged as commit `f9809c3`.

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

## Fabric integration (layer 8)

The helm supervisor is registered into the live Asolaria fabric as a layer-3 citizen daemon under parent voxel `AGT-L0-SPECIAL-OP-JESSE-H12D3`. Registration emits a canonical pipe-delim HBPv1 row to `C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp` (chained by `row_hash` per the L0-Jesse heartbeat pattern), with `.hbi/.sha256/.hex` sidecar trinity + `.voxel.json` consumer for the 3D map.

```bash
# Register (or re-register) the citizen in the local HyperBEHCS substrate.
# Reproducible — emits the canonical pipe-delim row, NOT the bigpickle internal format.
node bin/helm-register-citizen.mjs

# Append an observability heartbeat row capturing :4920-:4924 daemon snapshots.
# Chained by row_hash to the previous row. Run manually or schedule (cron/Task Scheduler).
node bin/helm-heartbeat-tick.mjs

# Run the integration test against the live acer fabric daemons.
# Skipped by default (CI-safe). Set env to opt in.
BIGPICKLE_RUN_FABRIC_PIPE=1 node --test tests/integration/helm-fabric-pipe.test.mjs

# Same plus the live POST through :4920 → :4922 → :4924 (mutates :4920 ledger).
BIGPICKLE_RUN_FABRIC_PIPE=1 BIGPICKLE_RUN_FABRIC_POST=1 node --test tests/integration/helm-fabric-pipe.test.mjs
```

The `helm-engines.json` registry has 28 entries: bigpickle modules on disk, all 11 live acer daemons (`:4920`-`:4924`, `:4951`-`:4969`), and the liris supervisor surface (`pi-supervisor`, `voxels`, `supervisors-domains`, `canon-index`, `cohort-c/d`, `behcs1024/dimension`, `alphabet-binding`, `super-os`).

**Authority**: quintuple umbrella granted universally 2026-05-24 → 2026-07-24. Cosigners as-given: `jesse-L0`, `jesse-L1`, `dan`, `rayssa`, `amy` (Felipe NOT named — recorded honestly in registration row + profile + memory; operator can re-cosign with canonical 5-name quintuple at any time). Auth anchor: `ASOLARIA-HERMES-ARCHITECT-CORRECTION-PID-2026-05-19`.

**Bilateral split** (acer ↔ liris): acer owns citizen registration + pipe-validation (daemons run only on acer); liris owns cohort/canon-index/voxel-merge surfaces (served only at liris `:4944`). See `SEED-MERGE-PROPOSAL.md` for the 4-option bilateral merge protocol.

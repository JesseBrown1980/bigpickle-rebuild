# BIGPICKLE Rebuild Spec

Drawn from Foundation v1 canon only. No quarantined-source DNA.

## What it does

A namespace-routed multi-agent dispatch substrate with formula-derived PID minting, single-call tree-search reasoning, and tuple-tagged emission.

## Core invariants (Foundation v1, Class-1 immutable)

1. **Port = label in N^K prefix tree.** Single socket multiplexes infinite labels. Routing is O(K) prefix-walk. NOT a TCP socket per "port."
2. **PID = `(actor, device, lane, prime)` Hilbert-bijective tuple.** Mathematically zero collisions. Formula-derived past test ceiling.
3. **Frontend inert.** Orchestrator triggers and guides. No shell wrapper, no banner, no header injection.
4. **Backend shelless rotation.** Function calls (sha16 PID-mint + verdict). Not process spawns.

## Hot path

Every artifact: `.hbp` (binary packet) + `.hbi` (index) + `.sha256` (digest) + `.hex` (hex dump). JSON only for cold compatibility / debug / dashboard output.

## Modules (planned, not built)

| Module | Role | Source spec |
|---|---|---|
| `port-router` | Prefix-walk routing on the namespace tree | `02-PORT-NAMESPACE-CANON.md` |
| `pid-minter` | Hilbert-bijective tuple → 1D PID index, formula-derived | `03-CUBE-OF-CUBES.md` + `05-100B-PID-MINTING.md` |
| `aot-runner` | Single-prompt tree search with inline GNN scoring | `04-AOT-ALGORITHM-OF-THOUGHT.md` |
| `hbp-emitter` | Writes `.hbp` + sidecars; cold JSON optional | `brown-hilbert/15-2026-05-16-hyperbehcs-hot-path.md` |
| `auto-translate` | 7-layer translate pipe | `06-AUTO-TRANSLATE-LAYERS.md` |
| `hookwall` | Tuple-aware gate before any emission | per memory `project_three_keys_hookwall_pid_gnn_loop_closure.md` |
| `gnn-forward` | Forward GNN inference | per BigPickle pipeline canon |
| `gnn-reverse-gain` | Extracts genius / mistakes / patterns / skills / tools | per BigPickle pipeline canon |
| `gc-runtime` | Gulp every N messages; mint or discard; flow-not-pile-up discipline | per `project_bigpickle_http_tracker_bypass_and_ramp_pattern_2026_05_24.md` |
| `pid-chain-revolver` | Per-request PID rotation inside one connection; subport-nested URL field | per `project_bigpickle_pid_chain_revolver_canonical_multiplex_pattern_2026_05_24.md` |

## Target throughput (from canon)

- 63 000 msg/sec single-host (CPU-bound ceiling)
- 189 000 msg/sec aggregate across 3 hosts
- Ramp checkpoints: 1 → 10 → 100 → 1 000 → 10 000 agents (per `project_bigpickle_http_tracker_bypass_and_ramp_pattern_2026_05_24.md`)
- At 10 K agents expect 5 GC gulps (`GC_TRIGGER_MESSAGES=2000`, 10 000 / 2 000 = 5)

## Non-goals (anti-divergence)

- ❌ Spawn 380k local processes (OS will die — operator-corrected)
- ❌ 36 TCP children as the multiplex (wrong substrate frame)
- ❌ Pre-mint 100B PIDs as files (memory explosion)
- ❌ Open 380k TCP connections (rate-limiter trip)
- ❌ HTTPS Claude-identifier headers in outbound calls (must use bare-node CLI)
- ❌ Per-spawn cosign-append (kills cosign chain — batch at 1 s)

## Composes with (do not break)

- Foundation v1 immutable canon at `C:\asolaria-foundation-v1\`
- Envelope queue at `C:\asolaria-foundation-v1\envelopes\` (FALCON-AERIAL, MASTER-PLAN-BEHCS-1024-SSOT-V1, OP-JESSE-ACK, PHASE-7-COMMIT, T3-BACKFILL-PID-INDEX, T3-ORPHAN-PID-MINT-MANIFEST-859)
- Sister-organ at liris :4944 (PRIMARY rotator authority)
- HBP hot-path discipline (15-2026-05-16-hyperbehcs-hot-path.md)
- v2 BEHCS-1024 amendment draft — subset embedding means v1 implementation stays valid

## Cosign gate

No promotion to live until: dual-apex cosign (OP-JESSE + OP-RAYSSA) + tests green + packet-first startup gate written.

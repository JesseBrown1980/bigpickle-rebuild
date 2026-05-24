# Tests Plan

Tests written before code. Each test states the spec invariant it pins.

## Layer 1 — algebraic invariants (pure functions, no I/O)

| Test | Invariant pinned | Spec source |
|---|---|---|
| `pid-bijection.test.mjs` | Two distinct `(actor, device, lane, prime)` tuples never collide on 1D PID index. Two equal tuples always collide. | `03-CUBE-OF-CUBES.md` |
| `pid-formula-derivable.test.mjs` | Same tuple → same PID across N runs without any stored state. | `05-100B-PID-MINTING.md` |
| `hilbert-locality.test.mjs` | Neighboring 1D indices map to neighboring k-D coordinates within Hilbert distortion bound. | `03-CUBE-OF-CUBES.md` |
| `port-prefix-walk.test.mjs` | Routing cost is O(K) hops, not O(N^K) scan. Benchmark below 1 µs/hop for K=10. | `02-PORT-NAMESPACE-CANON.md` |
| `subset-embedding.test.mjs` | A BEHCS-256 actor index is a valid BEHCS-1024 index. | `02-PORT-NAMESPACE-CANON.md` v2 |

## Layer 2 — envelope shape (file I/O, no network)

| Test | Invariant |
|---|---|
| `hbp-sidecars-emitted.test.mjs` | Every `.hbp` write produces `.hbi` + `.sha256` + `.hex` siblings. |
| `hbp-sha256-stable.test.mjs` | Identical envelope → identical SHA256. |
| `json-is-cold-only.test.mjs` | When `.hbp` is requested, no `.json` is written unless `cold=true` flag is set. |
| `tuple-tag-roundtrip.test.mjs` | 47D tuple → glyph → byte-encoded → glyph → tuple is identity. |

## Layer 3 — AoT semantics (single LLM call, mockable)

| Test | Invariant |
|---|---|
| `aot-single-call.test.mjs` | An AoT envelope produces exactly one outbound LLM call (not one per branch). |
| `aot-token-budget.test.mjs` | Token count for a 5-step / 3-path task is < 10 000 (vs. ~64 000 for old CoT). |
| `aot-branch-pids.test.mjs` | Each explored branch receives a fresh mintable PID. |
| `aot-records-as-edges.test.mjs` | When `record_branches_as_edges=true`, branch outcomes are appended to the GNN edge ledger. |

## Layer 4 — hookwall + GC pipeline (in-process, no live federation)

| Test | Invariant |
|---|---|
| `hookwall-gate.test.mjs` | Emission without a hookwall pass is rejected. |
| `gc-trigger-2000.test.mjs` | After 2 000 messages a gulp fires automatically; before 2 000 it does not. |
| `gc-flow-not-pile.test.mjs` | At sustained N msg/sec the file-cap stays below `fileCapWarnAt=1800`. |
| `pid-chain-rotates.test.mjs` | Successive requests in one revolver loop use distinct PIDs derived from Brown-Hilbert next. |

## Layer 5 — Foundation v1 envelope queue (test fixtures)

| Test | Input | Pass condition |
|---|---|---|
| `accept-foundation-envelopes.test.mjs` | Each `.hbp` at `C:\asolaria-foundation-v1\envelopes\` | Hookwall accepts, tuple-tag round-trips, sidecars verify. **Read-only — do not move or rewrite the originals.** |

## Layer 6 — oracle diff (quarantined originals as black box, no source read)

| Test | Method |
|---|---|
| `oracle-diff.test.mjs` | Send identical envelope to (a) rebuild and (b) quarantined oracle via wire-level invocation only. Diff outputs at SHA256 level. **Never read the oracle's source to explain a diff — fix from spec.** |

## Throughput targets (from canon, measured not invented)

- Single-host: 63 000 msg/sec ceiling (CPU-bound). Achieve ≥ 80 % of this before declaring parity.
- Aggregate (3 hosts): 189 000 msg/sec. Verified only after dual + tri-host wiring.
- Ramp checkpoints: pass at 1 → 10 → 100 → 1 000 → 10 000 agent loads.

## What NOT to test

- Do not run throughput benchmarks against the live substrate to "validate" — the post-Codex virtual stub returns 22/sec class numbers and will mislead. Run against the rebuild only.
- Do not test by editing quarantined source — that breaks white-room.

## Promotion gates

1. Layer 1–4 all green → spec internally consistent.
2. Layer 5 green → Foundation v1 envelopes accepted.
3. Layer 6 oracle diff ≤ 0.01 % byte-divergence on canonical fixture set → behavioral parity.
4. Dual-apex cosign (OP-JESSE + OP-RAYSSA) → promotion authorized.
5. Packet-first startup gate written + reviewed → eligible for live bus wiring.

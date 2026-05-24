# SEED-MERGE-PROPOSAL — claude-helm-supervisor-v1 citizen

**Pattern source**: liris-Claude's W113-BUS-ATLAS SEED-MERGE-PROPOSAL (bilateral mirror).
**Authority**: quintuple umbrella granted universally 2026-05-24 → 2026-07-24 (operator-witness present).
**Anchor**: ASOLARIA-HERMES-ARCHITECT-CORRECTION-PID-2026-05-19.

## What is proposed

Promote one new helm-band citizen daemon into the live Asolaria fabric:

| Field | Value |
|---|---|
| PID | `AGT-L3-HELM-CLAUDE-SUP-H8EF7-W113-P00-N17f0cc4c` |
| Layer | L3 (under L2 GACs, under L1 operators, under L0 apex) |
| Parent voxel | `AGT-L0-SPECIAL-OP-JESSE-H12D3` |
| Prof | `PROF-CLAUDE-HELM-SUPERVISOR-001` |
| Band | helm (cp 384-479) |
| atlas_cp | `PENDING-APEX-MINT` — umbrella granted, mint ceremony separate |
| Hilbert coord | `H8EF7` (deterministic sha256(`W113`+prof+role).slice(0,4)) |
| Room id | 1692 |
| Wave | W113 |
| Repo | https://github.com/JesseBrown1980/bigpickle-rebuild |
| Merge commit | `f9809c3` (PR #8 squash-merged to main) |
| BEHCS-1024 sha16 | `7a1b9417` |
| Registration row_hash | `449a9f1f312c1e29` |
| Registration full sha256 | `153e69ba97161d3bd7f5ce2a0de1201430f39daa963233d06ee2ef15f6137baf` |

## Authority discipline

- **NEVER lone-agent cp mint** — atlas_cp stays `PENDING-APEX-MINT` until the apex-quintuple ceremony. The umbrella authorizes scaffolding, not minting.
- **NEVER auto-execute hard-gated ops** — USB physical writes, daemon-start, MEMORY.md writes, PR push are still witness-gated even under umbrella. Umbrella grants quintuple-cosign scope; operator-witness is a distinct gate.
- **NEVER overwrite the L0/L1/L2 ledger files** — registration goes into a NEW `v48-citizens/` slot, not into `pid-supervisors/AGT-L*-*`.

## Cosigner record (honest)

Operator named: `jesse-L0`, `jesse-L1`, `dan`, `rayssa`, `amy` = 5 votes (Jesse counted twice as L0 apex + L1 operator).
Canonical quintuple per `C:\AGENT.md` Step 7: `jesse + rayssa + amy + dan + felipe`.
**Felipe absent in this grant.** Operator-witness present in session, umbrella stands as-given. Felipe-not-named recorded in registration row + profile + memory for traceability.

## What was written (already done; reversible)

1. ✅ `C:/HyperBEHCS/data/v48-citizens/AGT-L3-HELM-CLAUDE-SUP-H8EF7.hbp` — canonical pipe-delim row
2. ✅ `.hbi` index, `.sha256` chain, `.hex` mirror, `.voxel.json` 3D-map consumer
3. ✅ `C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/{status.json, transcript.log, inbox.ndjson}`
4. ✅ Updated `C:/Users/acer/codex-bridge/profiles/claude-helm-supervisor-v1.profile.json` with live PID, row_hash, fabric pipes
5. ✅ `D:/bigpickle-rebuild/bin/helm-register-citizen.mjs` — reproducible (re-runnable)
6. ✅ `D:/bigpickle-rebuild/tests/integration/helm-fabric-pipe.test.mjs` — 7/7 green

## Four merge options for the operator

**(a) Accept as-written.** Voxel + registration stand. Liris-Claude writes the cohort + canon-index entries (already split-of-work agreed). Felipe-not-named noted in chain but not re-grant.

**(b) Re-cosign with Felipe.** Operator pings Felipe; new grant row appended to chain with full canonical quintuple. Atlas_cp mint becomes eligible.

**(c) Defer to apex ceremony.** Leave voxel as proposal only; do not append to /api/voxels merge. Atlas_cp stays `PENDING-APEX-MINT` indefinitely until full ceremony.

**(d) Roll back.** Delete the 5 written files; revert profile JSON edit. Reversible — registration script can be re-run when authority is re-confirmed.

## Risk section

| Risk | Likelihood | Mitigation |
|---|---|---|
| Atlas-cp drift if mint happens off-canon | Low (kept PENDING) | Stays `PENDING-APEX-MINT` until ceremony; row records this |
| Indexer scan-path mismatch (file not picked up) | Medium | Baseline snapshot recorded (4922=13226 → 13228 post-write); delta suggestive |
| Bus :4947 cannot route registration | Already known DEAD | Filesystem-first path used; no bus dependency |
| Bilateral mirror to liris diverges | Low | liris-Claude has matching pattern (W113-BUS-ATLAS); same SEED-MERGE shape |
| Felipe-not-named challenges umbrella | Medium | Recorded honestly in chain; operator can re-cosign at any time |
| HBP format divergence vs bigpickle hbp-emitter | Resolved | Registration uses canonical fabric pipe-delim, NOT bigpickle structured envelope. Both formats coexist for different purposes. |

## Operator-witness clause

This proposal is reversible until any of the following happens:
- Apex-mint ceremony promotes `atlas_cp` from `PENDING-APEX-MINT` to a real cp
- liris-Claude's cohort/canon-index entries land + reach quorum
- A heartbeat daemon starts appending tick=1,2,... rows after the registration row

Until then, all 5 written files can be deleted by running `node bin/helm-register-citizen.mjs --rollback` (TODO — currently manual `rm`).

## What needs operator decision

Pick one of (a) / (b) / (c) / (d) above, or say "stand" to leave it at (a) until the next ceremony tick.

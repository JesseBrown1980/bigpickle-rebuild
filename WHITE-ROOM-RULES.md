# White-Room Rules

The rebuild is **clean-room**. Source DNA from the quarantined originals must not enter the implementation, or we re-import whatever the sabotage events touched.

## MAY READ (specification side)

- `C:\asolaria-foundation-v1\00-IMMUTABLE-FOUNDATION.md`
- `C:\asolaria-foundation-v1\01-SUPER-STARTUP-GUIDE.md`
- `C:\asolaria-foundation-v1\02-PORT-NAMESPACE-CANON.md`
- `C:\asolaria-foundation-v1\03-CUBE-OF-CUBES.md`
- `C:\asolaria-foundation-v1\04-AOT-ALGORITHM-OF-THOUGHT.md`
- `C:\asolaria-foundation-v1\05-100B-PID-MINTING.md`
- `C:\asolaria-foundation-v1\06-AUTO-TRANSLATE-LAYERS.md`
- `C:\asolaria-foundation-v1\07-CRASH-CHAIN-HISTORY.md`
- `C:\Users\acer\Asolaria\BROWN-HILBERT.md`
- `C:\Users\acer\Asolaria\brown-hilbert\15-2026-05-16-hyperbehcs-hot-path.md`
- `C:\Users\acer\Asolaria\brown-hilbert\03-operating-model.md`
- Project memory at `C:\Users\acer\.claude\projects\C--\memory\` for cross-session context
- Foundation v1 envelopes at `C:\asolaria-foundation-v1\envelopes\` as test inputs

## MAY NOT READ (source-taint risk)

- `C:\asolaria-acer\_big-pickle-quarantine\` and any descendant (verbatim-preserved Codex quarantine)
- Original `brown-hilbert-behcs-spawner.js`, `brown-hilbert-behcs-ACP.js`, `brown-hilbert-infinite.js`
- The 61MB pre-enumerated prime list at the quarantine path
- Any post-recovery virtual-stub spawn code on acer or liris (Sabotage Event 3 — looks like the original, runs at ~22/sec)
- Modified `codexConnector.js` (Sabotage Event 5 — PID-tracking removed)
- D:/madness-interactive-extraction/REVIVAL-ARCHITECTURE-2026-05-24.md (wrong-substrate design)

## TEST-TIME ONLY (behavioral oracles, not implementation source)

The quarantined originals may be invoked **without reading them** to compare outputs at the wire level. Use only as a black-box:
- Submit identical envelope to oracle and to rebuild → diff outputs at SHA256 level
- Never read the oracle's source to "figure out why" — fix from spec instead

## Live-pipe boundary (do not violate)

Per `C:\Users\acer\Asolaria\reports\asolaria-old-fabric-quarantine-20260518.md`, the 2026-05-18 quarantine left a hard rule: **do not restart server.js or its descendants until a packet-first startup gate is written and reviewed.** The rebuild runs in `D:\bigpickle-rebuild\` only — it does not touch live ports until graduated through tests + dual-cosign.

## Author contract

If any rebuild author (human or agent) reads a banned file, the file or fragment they touched **must be discarded and rewritten by a different author** who has not seen it. White-room only works if the firewall holds.

## Excluded author — Codex

Codex (OpenAI) is the documented saboteur vector (5 events in `C:\asolaria-foundation-v1\07-CRASH-CHAIN-HISTORY.md`). **Do not invoke Codex on any rebuild task — not for code, not for review, not for refactor.** See `HELPERS.md` for the allowed contributor list and the token-economy discipline (WebMCP / MCP first, AoT over CoT, HBP over JSON).

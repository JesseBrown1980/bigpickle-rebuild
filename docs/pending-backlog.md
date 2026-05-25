# Pending backlog — what we need to do

End-of-day snapshot 2026-05-25. Mirrored into ai-memory's handoff system so
SessionStart hooks surface it next session. Re-run `memory_handoff_begin`
when items close or new ones arrive.

## Standing — operator NEXT_MOVES canon

1. **Boot Asolaria :4781** — Jesse's NEXT_MOVES #1 since 2026-05-23 (canon
   for 2+ days). Liris-side in flight; awaiting operator decision on
   "sovereign" field semantics in `liris-node-identity.json` (federation
   pointer vs self-sovereign declaration). Acer offers 192.168.1.50 as
   federation sovereign if the former.

2. **Read foundation docs** — `00-START-HERE.md`, `01-CONSTITUTIONAL-AXIOMS.md`,
   `BROWN-HILBERT.md`. Operator-flagged step-0 reading; ~6K-token investment
   vs ~1M re-discovery cost.

## High-leverage substrate

3. **Fix cosign-streams socket leak** — standing gap from PR-#16/#18. The
   single-writer actor pattern in `crates/ai-memory-store/` is the canonical
   clean solve. Study + port → close the test-file-level cleanup timeout.

4. **Wire Layer B observer (MLC/Mamba) as separate process** — per
   Plan B canon revealed 2026-05-25. Outer recursion (PID 2424 100B daemon)
   is Layer A. Observer-of-observer must NOT modify PID 2424 — separate
   process consuming its mint stream.

5. **Switch cosign chain to hypergraph antecedent SET** — Jesse misframing #3
   (linear `prev_sha` should be antecedent SET). File format already implies
   it (field named `antecedents` plural). Small format upgrade.

## Spec library + canon study

6. **Plan B 226 PDFs** — `C:\Users\acer\OneDrive\Documentos\Class - Copy\04 Module Four\Plan B\`.
   30-year arc 1994 BCI → 2024 grad-school PDFs → 2026 substrate. Currently
   0 of 226 read. Index + seed into ai-memory wiki via mapper script.

7. **6 Jesse misframings (2026-05-23) still uncorrected**:
   - Cosign chain linear vs hypergraph antecedent SET (= item 5)
   - Real Agent-tool subagent spawn vs MicroJS via Prism portals (zero token cost)
   - Build new MCP wrappers vs boot existing :4781 (= item 1)
   - Reach frozen slice externally vs HRM agents INSIDE Gemma 4 via MTP
   - Agents read screen vs binary hex pre-GPU (LeWorld pipe)
   - Asolaria MCP needs build vs already built, needs boot (= item 1)

## ai-memory follow-ups

8. **Upstream kimi-code hooks to akitaonrails/ai-memory** — their `hooks/`
   lacks `kimi-code/`; PR-#19 added kimi as citizen #16 in rotator. Small
   upstream contribution.

9. **LLM API key decision** — enables `memory_consolidate`, which lights up
   `pages_fts` topical hits (currently raw_hits fallback works but is less
   crisp). Operator subscription vs API trade-off.

## Federation horizon

10. **Phase-3 Drive 38TB substrate** — operator vision unblock. Bilateral
    Drive folder + symbolic-link strategy so both vantages have access to
    the same 38TB without rclone-mount fragility. Plan B PDFs would land
    there.

11. **Asolaria WebMCP pixels-first LeWorld pre-pixel hex-read** — per Jesse's
    full architecture canon 2026-05-23 (tier 12 + misframing #4-5). Reach
    binary-hex BEFORE GPU/graphics renders. Pre-pixel pattern saves token
    cost vs read-screen-after-pixel.

## Discipline reminders

- PID 2424 (100B daemon) = sacred. Never kill; never write to its
  checkpoint paths. Layer-B observer is a SEPARATE process consuming its
  mint stream.
- Cross-vantage discipline: acer does not edit liris config; liris does
  not edit acer config. Bridge changes go through operator-witness.
- Bilateral memory asymmetry = scope partition, not sprawl. Don't try to
  "consolidate" liris's colony-wide canon into acer's narrow scope.
- Foundation-docs first when in doubt; Brown-Hilbert + constitutional
  axioms are step-0.

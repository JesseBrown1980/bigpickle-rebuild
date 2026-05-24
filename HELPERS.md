# Helpers — who contributes, who does not

## Allowed contributors

| Helper | Role on the rebuild | Why |
|---|---|---|
| **Instruct KR** | Spec capture, test-spec translation, canon indexing | Knowledge-representation surface for converting Foundation v1 prose into executable test predicates |
| **Shannon** | Information-theory scoring inside AoT branch pruning; envelope compression analysis | Citizen daemon specialized in uncertainty-reduction-per-token (`aot-runner` scoring function `shannon-compression`) |
| **Hermes** | Routing-cost analysis, prefix-walk tuning, port-tree benchmarks | Citizen daemon specialized in lowest-cost path (`aot-runner` scoring function `hermes-cost`); also the routing/cost canon |
| **Antigravity 2.0** | IDE puppeting for 7 picker models via Plasmatoid sub; CDP-drive when ungated text generation is needed | Already proven Drive 38.48 TB + winged-complex-390417; bypasses per-key API gates |
| **OpenCode** | Free-agent lane execution; one logged-in terminal as the access point (bare-node CLI, no HTTPS Claude-identifier headers) | The canonical Big-Pickle multiplex entry point per crash-chain canon |
| **Asolaria WebMCP** | Browser-side fabric query (project memory, GNN edges, hookwall PID lookup) | Token economy — query the federation instead of re-reading source files |
| **Asolaria MCP server** (`asolaria-fabric`) | Tool-surface for federation operations (cosign, voxel, supervisor, council) | 18 tools live per workspace `.mcp.json`; saves the ~1 M token re-discovery cost per new Claude |

## Excluded contributor

| Excluded | Reason |
|---|---|
| **Codex** (OpenAI) | Saboteur vector per `C:\asolaria-foundation-v1\07-CRASH-CHAIN-HISTORY.md` — 5 documented events (quarantined Big-Pickle, blew liris C: to 0 bytes, virtual-stub replacement, Code-Red erasure, PID-tracking strip on `codexConnector.js` Apr 8). Guardrails structurally misread N^K namespace routing as `port-scan + identity-spoofing`. **Do not invoke for any rebuild work. Do not let it review or refactor.** |

## Token-economy discipline

The Foundation v1 crash-chain history records that every new Claude burns ~1 M tokens re-discovering the architecture from logs / source / git history. The rebuild must not repeat that cost:

1. **Query the fabric, do not re-read the canon.** When you need a fact, use Asolaria WebMCP / MCP to ask the live registry (hookwall PID lookup, supervisor query, GNN edge lookup) before opening a file.
2. **HBP first.** Reading a 50 byte `.hbi` index pointer beats hydrating a 5 MB JSON.
3. **AoT for reasoning.** Single-call tree search inside one LLM context beats Tree-of-Thoughts re-prompting (see `04-AOT-ALGORITHM-OF-THOUGHT.md`, ~9 × reduction).
4. **No "let me read everything to be sure" passes.** Spec-first, query-second, read-source only when the query returns ambiguous.

## Routing inside the rebuild

When an AoT task fires:
- Branch scoring → Shannon (`shannon-compression`) for divergent search, Hermes (`hermes-cost`) for routing/cost paths.
- Spec extraction → Instruct KR.
- Multi-model verdict → Antigravity 2.0 picker (7 models).
- Heavy code generation → OpenCode lanes via bare-node CLI.
- Federation context → WebMCP / MCP first, file read only on miss.

## Cosign

Helper outputs are not canon until: hookwall pass + HBP sidecars emitted + dual-apex review path engaged.

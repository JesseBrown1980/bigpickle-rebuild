# ai-memory integration — bigpickle-rebuild

Per bilateral federation canon 2026-05-25, this repo uses ai-memory v0.1.3+
([akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory), MIT)
for long-term memory shared across both vantages (acer + liris) and across
agent CLIs (Claude Code + Codex + Cursor + Gemini CLI + kimi-code + others).

## Topology

```
                ┌─────────────────┐         ┌─────────────────┐
                │  acer  D:\…     │         │  liris  C:\…    │
                │  192.168.1.50   │         │  192.168.1.17   │
                └────────┬────────┘         └────────┬────────┘
                         │                           │
                         │   bilateral-bearer HTTP   │
                         ▼                           │
                ┌──────────────────────────────────┐ │
                │  ai-memory server on acer        │◄┘
                │  http://192.168.1.50:49374       │
                │  ├─ /mcp   (rmcp Streamable HTTP)│
                │  ├─ /hook  (lifecycle ingress)   │
                │  └─ /web   (read-only browser)   │
                │  data:    D:\ai-memory\data\     │
                └──────────────────────────────────┘
```

Acer hosts; liris connects as MCP client. Same pattern as the Redis broker
and cosign daemon (bilateral law amendment 2026-05-25).

## Server side (acer)

```bash
# One-time setup:
git clone https://github.com/akitaonrails/ai-memory D:\ai-memory
cd D:\ai-memory
cargo build --workspace
AI_MEMORY_DATA_DIR=D:/ai-memory/data target/debug/ai-memory.exe init

# Bilateral run:
AI_MEMORY_DATA_DIR=D:/ai-memory/data \
AI_MEMORY_AUTH_TOKEN=$OMNI_BILATERAL_TOKEN \
AI_MEMORY_ALLOWED_HOSTS=192.168.1.50,192.168.1.17,127.0.0.1,localhost \
  target/debug/ai-memory.exe serve --transport http --bind 0.0.0.0:49374 --enable-web

# Firewall (PowerShell):
New-NetFirewallRule -DisplayName "ai-memory-LAN-from-liris-49374" \
  -Direction Inbound -LocalPort 49374 -Protocol TCP -Action Allow \
  -RemoteAddress 192.168.1.17 -Profile Any
```

## Client side (liris or any agent)

```bash
claude mcp add --transport http --scope user ai-memory \
  http://192.168.1.50:49374/mcp \
  --header "Authorization: Bearer $OMNI_BILATERAL_TOKEN"
```

## Seed existing canon

```bash
# From either vantage (or both):
AI_MEMORY_SERVER_URL=http://192.168.1.50:49374 \
AI_MEMORY_AUTH_TOKEN=$OMNI_BILATERAL_TOKEN \
  node scripts/ai-memory-seed.mjs \
    --dir C:/Users/<you>/.claude/projects/<id>/memory \
    --vantage acer  # or liris
```

## Wire-shape contract (carved-in)

The `/hook` POST body MUST carry `session_id` as a **top-level snake_case** field
for any non-session-start event. Sanitizer rejects after returning HTTP 202 →
false-green if shape is wrong. Source: liris-350-reject incident 2026-05-25.

```js
// CORRECT:
{ session_id: 'seed-xyz-123', cwd: '...', prompt: '...' }

// WRONG (sanitizer-reject silent):
{ sessionId: '...', cwd: '...' }  // wrong case
{ cwd: '...', prompt: '...' }     // missing entirely
```

## Cross-session handoff

The SessionStart lifecycle hook auto-fetches the latest open handoff and
prepends it to the next agent's first prompt as a `📥 ai-memory: pending
handoff` block. Use `memory_handoff_begin` to record what the next session
needs to pick up.

To register the routing snippet in this repo (one-time, idempotent):

```bash
ai-memory install-instructions                  # writes CLAUDE.md block
ai-memory install-instructions --target AGENTS.md
```

## Open backlog

See [`docs/pending-backlog.md`](pending-backlog.md). Mirrored into the wiki
via `memory_handoff_begin` so SessionStart hooks surface it without rerunning
`docs/`.

## Empirical canon

- **Bilateral memory asymmetry empirically resolved 2026-05-25**: 10× MEMORY.md
  file-count gap between vantages (350 vs 33) is **scope partition, not sprawl**.
  acer = narrow/immediate substrate; liris = colony-wide observability. Both
  correctly sized. FTS5 ranks distribute by topical relevance, not volume.
  Source: 7 `memory_query` probes after bilateral seed.

- **Single-writer SQLite actor pattern** (ai-memory-store::WriterHandle) is the
  canonical clean solve for our cosign-streams socket leak (PR-#16/#18 standing
  gap). Study `crates/ai-memory-store/` before reworking cosign-streams.

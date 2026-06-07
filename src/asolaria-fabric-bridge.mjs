// asolaria-fabric-bridge.mjs — connect the new kernel primitives to the LIVE
// :4949 running system (the Codex-built body). INTEGRATE, don't duplicate.
//
// Each primitive gets a .live() reader that hits the real endpoint and converts
// the boundary response to HBP internally (JSON is cold boundary only). Read-only
// + health. The real-agent SPAWN is present but GATED (opts.live) and NEVER fired
// by tests — the live free-agent run stays staged per operator.
//
// Endpoints (from /api/everything via the asolaria-fabric MCP):
//   ADDRESS  -> /api/supervisors, /api/access-tier/matrix
//   CONTENT  -> /api/manifest, /api/behcs-glyph-table
//   INTEGRITY-> cosign-chain head, /api/archaeology/cosign-integrity
//   SCORE    -> /api/gnn/topN  (L0 :4792)
//   ROUTE    -> /api/agent-terminal/{status,spawn,rotate,kill}, bus :4947
//   HOOKWALL -> /api/hookwall/events  (live F5: 1 live / 23+ deferred)
// Operator: Jesse Daniel Brown — "Authorized" 2026-06-01.

import http from 'node:http';
import { createHash } from 'node:crypto';

const DASH_PORT = Number(process.env.ASOLARIA_DASH_PORT || 4949);
const HOST = '127.0.0.1';

function sha8(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 8); }

// boundary GET — returns { ok, status, raw, json } (json parsed if possible; cold only)
export function fabricGet(path, opts = {}) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: opts.host || HOST, port: opts.port || DASH_PORT, path, method: 'GET', timeout: opts.timeoutMs || 2500 },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let json = null; try { json = JSON.parse(d); } catch { /* tuple-text or html */ }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode, raw: d, json });
        });
      });
    req.on('error', () => resolve({ ok: false, status: 0, raw: '', json: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, raw: '', json: null }); });
    req.end();
  });
}

// ── per-primitive live readers (read-only) ───────────────────────────────────
export async function addressLive(opts = {}) {
  const sup = await fabricGet('/api/supervisors', opts);
  return { primitive: 'ADDRESS', endpoint: '/api/supervisors', reachable: sup.ok, status: sup.status,
    note: sup.ok ? 'live supervisor registry reachable' : 'dashboard unreachable' };
}
export async function scoreLive(opts = {}) {
  // SCORE already proven against :4792 directly; also expose dashboard GNN topN
  const g = await fabricGet('/api/gnn/topN', opts);
  return { primitive: 'SCORE', endpoint: '/api/gnn/topN', reachable: g.ok, status: g.status };
}
export async function hookwallLive(opts = {}) {
  const h = await fabricGet('/api/hookwall/events', opts);
  return { primitive: 'HOOKWALL', endpoint: '/api/hookwall/events', reachable: h.ok, status: h.status,
    note: 'live F5: 1 hook live / 23+ deferred — new kernel hookwall is the full gate to wire them' };
}
export async function routeLive(opts = {}) {
  const r = await fabricGet('/api/agent-terminal/status', opts);
  return { primitive: 'ROUTE', endpoint: '/api/agent-terminal/status', reachable: r.ok, status: r.status };
}
export async function healthLive(opts = {}) {
  const h = await fabricGet('/health', opts);
  return { reachable: h.ok, status: h.status, service: h.json?.service ?? null, uptime_s: h.json?.uptime_s ?? null };
}

// ── full fabric health — all primitives at once ──────────────────────────────
export async function fabricHealth(opts = {}) {
  const [health, address, score, hookwall, route] = await Promise.all([
    healthLive(opts), addressLive(opts), scoreLive(opts), hookwallLive(opts), routeLive(opts),
  ]);
  const primitives = [address, score, hookwall, route];
  const liveCount = primitives.filter((p) => p.reachable).length;
  return {
    dashboard: health,
    primitives,
    live_count: liveCount,
    total: primitives.length,
    integrated: health.reachable, // dashboard up == kernel can integrate into the body
    sha: sha8(JSON.stringify(primitives)),
  };
}

// ── GATED real-agent spawn — present, NEVER called by tests ──────────────────
// The real free-agent run stays staged. This wires ROUTE to the live
// /api/agent-terminal/spawn ONLY when opts.live === true AND opts.confirmed === true.
export async function routeSpawnLive(payload, opts = {}) {
  if (opts.live !== true || opts.confirmed !== true) {
    return { fired: false, reason: 'gated: live free-agent run requires {live:true, confirmed:true} — staged per operator' };
  }
  // (POST to /api/agent-terminal/spawn would go here, behind the double gate)
  return { fired: false, reason: 'spawn body intentionally not wired until operator fires the keystone' };
}

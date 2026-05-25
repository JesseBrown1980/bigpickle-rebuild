// Model-citizen-rotator — the project-name-swap pattern applied to MODELS.
//
// Spec: project_quintuple_authority_grant_plus_master_architecture_2026_05_25.md (Phase 11)
//       operator-directive 2026-05-25 "model rotator for Google + DeepSeek + Claude + Gemini + Codex"
//
// Each model becomes a CITIZEN with:
//   - PID-minted identity (sha16 from canonical name)
//   - Glyph (BEHCS-1024)
//   - Cube cell (cp + bh_3d coord)
//   - canSummon flag (CLI present? API endpoint reachable? auth ready?)
//   - summonHandle (function that wraps the call — backend-shelless where possible)
//
// Composes with fabric-thinker-gnn for routing (GNN classifies WHICH model best fits an intent).
//
// Per backend-shelless invariant: real summons use FUNCTION CALLS where possible
// (HTTP to existing servers, MCP protocol). CLI subprocess only ONE per room
// (rotor pattern), not one per agent.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import { hilbertEncode } from './hilbert.mjs';

function sha16(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }

// === Citizen registry =====================================================

export const CITIZENS = Object.freeze([
  // CLI-summonable
  { id: 'claude',   kind: 'cli',  cmd: 'claude',  cp: 700, license: 'subscription-anthropic', desc: 'Anthropic Claude (Code CLI)' },
  { id: 'gemini',   kind: 'cli',  cmd: 'gemini',  cp: 705, license: 'subscription-google',    desc: 'Google Gemini CLI' },
  { id: 'codex',    kind: 'cli',  cmd: 'codex',   cp: 710, license: 'subscription-openai',    desc: 'OpenAI Codex CLI' },
  { id: 'lms',      kind: 'cli',  cmd: 'lms',     cp: 715, license: 'free-local',             desc: 'LMStudio local-model CLI' },
  { id: 'gcloud',   kind: 'cli',  cmd: 'gcloud',  cp: 720, license: 'subscription-google',    desc: 'Google Cloud SDK (Drive/Compute/etc.)' },
  // HTTP-summonable (existing fabric services)
  { id: 'gnn-l0',   kind: 'http', host: '127.0.0.1', port: 4792, path: '/health',  cp: 485, license: 'our-canon', desc: 'EdgeLevelGNN L0 (4-layer cascade)' },
  { id: 'gnn-l4',   kind: 'http', host: '127.0.0.1', port: 4793, path: '/health',  cp: 488, license: 'our-canon', desc: 'GSLGNN L4 (port :4793 if loaded)' },
  { id: 'cosign-daemon', kind: 'http', host: '127.0.0.1', port: 4953, path: '/api/cosign/head', cp: 340, license: 'our-canon', desc: 'Cosign chain HTTP daemon' },
  { id: 'redis-broker', kind: 'redis', host: '127.0.0.1', port: 6379, cp: 390, license: 'oss', desc: 'Acer-hosted Redis 7-alpine bilateral broker' },
  // Web-only / unavailable-local
  { id: 'deepseek', kind: 'web',  cp: 800, license: 'web-tui',                desc: 'DeepSeek (web TUI, no local CLI yet)' },
  { id: 'antigravity', kind: 'cli', cmd: 'antigravity', cp: 750, license: 'local-app', desc: 'Antigravity IDE (operator-mentioned)' },
  // Additional model-citizens (operator extension 2026-05-25)
  { id: 'cursor',         kind: 'cli', cmd: 'cursor',     cp: 725, license: 'subscription-anysphere', desc: 'Cursor IDE CLI' },
  { id: 'abacusai',       kind: 'cli', cmd: 'abacusai',   cp: 730, license: 'subscription-abacusai',  desc: 'AbacusAI app/CLI' },
  { id: 'auggie',         kind: 'cli', cmd: 'auggie',     cp: 735, license: 'subscription-augment',   desc: 'Auggie CLI (Augment)' },
  { id: 'augment-code',   kind: 'cli', cmd: 'augment',    cp: 740, license: 'subscription-augment',   desc: 'Augment Code CLI' },
  { id: 'kimi-code',      kind: 'cli', cmd: 'kimi',       cp: 745, license: 'mit-moonshot-oauth',     desc: 'Moonshot AI Kimi Code CLI (MIT, single-binary, MCP + lifecycle hooks)' },
]);

// === Pure: PID + glyph + cube address per citizen =========================

export function citizenIdentity(citizen) {
  const pid = `MODEL-${citizen.id.toUpperCase()}-${sha16(citizen.id + '|' + citizen.kind).slice(0, 6).toUpperCase()}`;
  const bh = hilbertEncode([(citizen.cp >> 0) & 0xf, (citizen.cp >> 4) & 0xf, (citizen.cp >> 8) & 0x3], { dimensions: 3, bits: 4 });
  const cube_cell = `cube:model-cp${citizen.cp}-bh${bh}`;
  const glyph = sha16(`glyph|${citizen.id}|${citizen.cp}`);
  return { pid, glyph, cube_cell, bh_3d_idx: bh };
}

// === Probes (canSummon checks) ============================================

function probeCli(cmd) {
  try {
    const r = spawnSync('cmd.exe', ['/c', 'where', cmd], { encoding: 'utf8', timeout: 3000 });
    return r.status === 0 && r.stdout && r.stdout.trim().length > 0;
  } catch { return false; }
}

function probeHttp(host, port, path = '/health', timeout_ms = 1500) {
  return new Promise((resolve) => {
    const req = http.request({ host, port, path, method: 'GET', timeout: timeout_ms }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

export async function canSummon(citizen) {
  if (citizen.kind === 'cli') return probeCli(citizen.cmd);
  if (citizen.kind === 'http') return await probeHttp(citizen.host, citizen.port, citizen.path);
  if (citizen.kind === 'redis') return await probeHttp(citizen.host, citizen.port); // crude — checks port open
  return false; // web/unknown
}

// === Public: census ========================================================

export async function census(opts = {}) {
  const rows = [];
  for (const c of CITIZENS) {
    const ident = citizenIdentity(c);
    const ready = await canSummon(c);
    rows.push({ ...c, ...ident, ready });
  }
  return {
    algorithm: 'model-citizen-rotator-census.v1',
    ts_iso: new Date().toISOString(),
    total: rows.length,
    ready_count: rows.filter(r => r.ready).length,
    citizens: rows,
  };
}

// === Public: rotate (pick next-best citizen for an intent) ================
//
// Naive rotator: round-robin among ready citizens whose kind matches the intent.
// Future: route via fabric-thinker-gnn (real GNN classification of intent → best model).

const _rotationCursor = { idx: 0 };

export function rotate(intent, opts = {}) {
  const kindFilter = opts.kind ?? null;
  const readyList = (opts._census?.citizens ?? CITIZENS).filter(c => {
    if (kindFilter && c.kind !== kindFilter) return false;
    return opts._census ? c.ready : true;
  });
  if (readyList.length === 0) return null;
  const picked = readyList[_rotationCursor.idx % readyList.length];
  _rotationCursor.idx++;
  return { ...picked, ...citizenIdentity(picked), rotation_idx: _rotationCursor.idx - 1 };
}

// === Status ===============================================================

export const STATUS = Object.freeze({
  schema: 'model-citizen-rotator.v1',
  pattern: 'project-name-swap-applied-to-models',
  citizens_registered: CITIZENS.length,
  cli_citizens: CITIZENS.filter(c => c.kind === 'cli').map(c => c.id),
  http_citizens: CITIZENS.filter(c => c.kind === 'http').map(c => c.id),
  api: ['census', 'rotate', 'canSummon', 'citizenIdentity'],
  composes_with: ['fabric-thinker-gnn (route intent → best model)', 'cosign-streams (seal each rotation as durable event)'],
  backend_shelless: 'cli summons use ONE subprocess per room (rotor pattern), not per agent',
  spec: 'project_quintuple_authority_grant_plus_master_architecture_2026_05_25.md Phase 11',
  honest_gaps: [
    'summon execution not yet implemented — census + rotate only (registry layer)',
    'deepseek has no local CLI; web-only kind; would need MCP or HTTP shim',
    'lms can spawn local server; full LMStudio API not yet wrapped',
    'gcloud + drive auth still pending operator /mcp Drive select',
  ],
});

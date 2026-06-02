// federation-overlay-server.mjs
//
// Acer-vantage federation overlay HTTP server on :4957.
//
// Purpose: surface federation primitives (Zeta, BEHCS-1024 glyphs, PID
// supervisors, VAT-v1 tokens, quintet compliance) WITHOUT mongoose
// dependency. Pure file-substrate reads + bigpickle/Asolaria primitives.
//
// Authority: CEO-ASOLARIA-INSTANCES (PID 9198ed80b00dddee, hilbert 892)
//   via SPECIAL-OP-JESSE-PROFILE (PID fbd2e15a78c63b91, hilbert 896, layer apex)
//   per operator directive 2026-05-29T20Z "CEO DECIDES ALL AND AUTHORITY
//   TO ORDER SPECIAL OP JESSE TO TELL THE FABRIC TO HELP through the PID system".
//
// Bilateral mirror of liris :4944 /api/supervisors endpoint pattern.
//
// HBPv1 pipe-row default. ?format=json opt-in. No JSON in hot path.
//
// Zero mongoose. Zero application-layer coupling. Bridge candidate for
// EZ Protect admin /agent dashboard.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { vonMangoldt, nuLambda } from './zeta-process.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4957;
const REG_DIR = 'D:/PID-Registration-Office/registered';
const ATLAS_DIR = 'D:/PID-Registration-Office/atlas-registrations';
const SHARES_DIR = 'D:/BEHCS-Omnifile/mirror/acer/shares';

const sha16 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const glyph1024 = (s) => parseInt(crypto.createHash('sha256').update(s).digest('hex').slice(0, 8), 16) % 1024;
const glyph5 = (s) => parseInt(crypto.createHash('sha256').update(s).digest('hex').slice(0, 8), 16) % 5;

const pipe = (obj) => Object.entries(obj)
  .map(([k, v]) => `${k}=${String(v).replace(/[|\r\n]/g, '_')}`)
  .join('|');

const emit = (res, status, hbpRow, jsonObj, asJson) => {
  res.setHeader('Content-Type', asJson ? 'application/json' : 'text/plain; charset=utf-8');
  if (status) res.writeHead(status);
  res.end(asJson ? JSON.stringify(jsonObj) : hbpRow);
};

function readSupervisors() {
  if (!fs.existsSync(REG_DIR)) return [];
  const out = [];
  for (const f of fs.readdirSync(REG_DIR).filter(x => x.endsWith('.hbp'))) {
    try {
      const body = fs.readFileSync(path.join(REG_DIR, f), 'utf-8');
      const m = (re) => (body.match(re) || [null, null])[1];
      const baseName = f.slice(0, -4);
      const sibs = ['.hbi', '.hex', '.sha256', '.ing'];
      const quintet = sibs.every(s => fs.existsSync(path.join(REG_DIR, baseName + s)));
      out.push({
        name: m(/^NAME\|(.+)$/m) || baseName,
        pid: m(/PID\|([0-9a-f]{16})/) || 'unknown',
        hilbert: parseInt(m(/^HILBERT\|(\d+)/m) || '0', 10) || null,
        layer: m(/^LAYER\|([^\r\n|]+)/m),
        class: (m(/^CLASS\|([^\r\n]+)/m) || '').slice(0, 200),
        glyph_1024: m(/^GLYPH_BEHCS1024\|([^\r\n|]+)/m),
        glyph_5: m(/^GLYPH_BEHCS5\|([^\r\n|]+)/m),
        quintet,
        file: f,
      });
    } catch (e) {}
  }
  return out;
}

function countQuintetCompliance() {
  if (!fs.existsSync(SHARES_DIR)) return { hbp: 0, full_quintet: 0, pct: 0 };
  const files = fs.readdirSync(SHARES_DIR);
  const hbps = files.filter(f => f.endsWith('.hbp'));
  let compliant = 0;
  for (const h of hbps) {
    const base = h.slice(0, -4);
    const sibs = ['.hbi', '.hex', '.sha256', '.ing'];
    if (sibs.every(s => fs.existsSync(path.join(SHARES_DIR, base + s)))) compliant++;
  }
  return { hbp: hbps.length, full_quintet: compliant, pct: hbps.length ? Math.round(100 * compliant / hbps.length) : 0 };
}

function issueVAT(agentPID, agentGlyph, sessionSeed) {
  const ikm = sha256(sessionSeed + ':' + agentPID + ':' + agentGlyph);
  const tokenId = ikm.slice(0, 20).toUpperCase();
  const issued = new Date().toISOString();
  const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { tokenId, agentPID, agentGlyph, sessionSeed, issued, exp, alg: 'sha256-hkdf-stub' };
}

const ROUTES = {
  '/health': (req, res, _, asJson) => {
    const supCount = readSupervisors().length;
    const qc = countQuintetCompliance();
    const obj = {
      ok: true,
      service: 'federation-overlay-server',
      vantage: 'acer',
      port: PORT,
      authority: 'CEO-ASOLARIA-INSTANCES_via_SPECIAL-OP-JESSE-PROFILE',
      supervisors: supCount,
      quintet_compliance: qc,
      uptime_s: Math.round(process.uptime()),
      anchor: 'FEDERATION-OVERLAY-2026-05-29T20Z'
    };
    if (asJson) return emit(res, 0, null, obj, true);
    emit(res, 0, pipe({ kind: 'HEALTH', ...obj, quintet_compliance: `${qc.full_quintet}/${qc.hbp}_${qc.pct}_pct` }), null, false);
  },

  '/api/supervisors': (req, res, p, asJson) => {
    const all = readSupervisors();
    const sub = p === '/api/supervisors' ? '' : decodeURIComponent(p.slice('/api/supervisors/'.length));
    if (sub) {
      const idLower = sub.toLowerCase();
      const found = all.find(s => (s.name || '').toLowerCase() === idLower) ||
                    all.find(s => s.pid === sub) ||
                    all.find(s => (s.name || '').toLowerCase().includes(idLower));
      if (!found) return emit(res, 404, pipe({ kind: 'NOT_FOUND', ok: false, id: sub }), { ok: false, id: sub }, asJson);
      return asJson ? emit(res, 0, null, { ok: true, supervisor: found }, true) : emit(res, 0, pipe({ kind: 'SUPERVISOR_DETAIL', ok: true, ...found }), null, false);
    }
    if (asJson) return emit(res, 0, null, { ok: true, count: all.length, vantage: 'acer', supervisors: all }, true);
    const rows = [pipe({ kind: 'SUPERVISORS', ok: true, count: all.length, vantage: 'acer', registry_dir: REG_DIR })];
    rows.push(...all.map(s => pipe({ kind: 'SUPERVISOR', name: s.name, pid: s.pid, hilbert: s.hilbert || '', layer: s.layer || '', quintet: s.quintet, file: s.file })));
    emit(res, 0, rows.join('\n') + '\n', null, false);
  },

  '/api/zeta/predict': (req, res, p, asJson, query) => {
    const n = parseInt(query.n || '0', 10);
    if (!Number.isFinite(n) || n < 2) return emit(res, 400, pipe({ kind: 'BAD_REQUEST', ok: false, reason: 'n_must_be_>=2' }), { ok: false }, asJson);
    const lambda = vonMangoldt(n);
    const nu = nuLambda(n);
    const result = { n, vonMangoldt: lambda, nuLambda: nu, isPrime: lambda > 0 };
    if (asJson) return emit(res, 0, null, { ok: true, ...result }, true);
    emit(res, 0, pipe({ kind: 'ZETA_PREDICT', ok: true, ...result }), null, false);
  },

  '/api/glyphs/encode': (req, res, p, asJson, query) => {
    const flag = String(query.flag || '');
    if (!flag) return emit(res, 400, pipe({ kind: 'BAD_REQUEST', ok: false, reason: 'flag_required' }), { ok: false }, asJson);
    const result = { flag, glyph_1024: glyph1024(flag), glyph_5: glyph5(flag), sha16: sha16(flag) };
    if (asJson) return emit(res, 0, null, { ok: true, ...result }, true);
    emit(res, 0, pipe({ kind: 'GLYPH_ENCODE', ok: true, ...result }), null, false);
  },

  '/api/vat/issue': (req, res, p, asJson, query) => {
    const agentPID = String(query.pid || '');
    const agentGlyph = String(query.glyph || '');
    const sessionSeed = String(query.seed || 'session-default');
    if (!agentPID) return emit(res, 400, pipe({ kind: 'BAD_REQUEST', ok: false, reason: 'pid_required' }), { ok: false }, asJson);
    const vat = issueVAT(agentPID, agentGlyph, sessionSeed);
    if (asJson) return emit(res, 0, null, { ok: true, vat }, true);
    emit(res, 0, pipe({ kind: 'VAT_ISSUE', ok: true, ...vat }), null, false);
  },

  '/api/quintet/compliance': (req, res, p, asJson) => {
    const qc = countQuintetCompliance();
    if (asJson) return emit(res, 0, null, { ok: true, ...qc, dir: SHARES_DIR }, true);
    emit(res, 0, pipe({ kind: 'QUINTET_COMPLIANCE', ok: true, ...qc, dir: SHARES_DIR }), null, false);
  },
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const asJson = url.searchParams.get('format') === 'json';
  const query = Object.fromEntries(url.searchParams.entries());
  const p = url.pathname;

  if (ROUTES[p]) return ROUTES[p](req, res, p, asJson, query);
  if (p.startsWith('/api/supervisors/')) return ROUTES['/api/supervisors'](req, res, p, asJson, query);

  emit(res, 404, pipe({
    kind: 'UNKNOWN_ROUTE',
    ok: false,
    path: p,
    routes: '/health,/api/supervisors,/api/supervisors/:id,/api/zeta/predict?n=N,/api/glyphs/encode?flag=X,/api/vat/issue?pid=P&glyph=G&seed=S,/api/quintet/compliance'
  }), { ok: false, error: 'unknown route', path: p }, asJson);
});

server.listen(PORT, () => {
  const msg = pipe({
    kind: 'STARTUP',
    service: 'federation-overlay-server',
    vantage: 'acer',
    port: PORT,
    pid: process.pid,
    authority: 'CEO-ASOLARIA-INSTANCES_via_SPECIAL-OP-JESSE-PROFILE',
    routes: 7,
    started_at: new Date().toISOString()
  });
  process.stdout.write(msg + '\n');
});

// fischer-live.mjs — the LIVE host for the Fischer Kernel.
//
// Turns the (otherwise dormant) anti-blunder evaluator into a running service:
// every envelope POSTed is scored by the 7-GNN ensemble, evaluated by the
// Fischer Kernel, and the sealed FISCHERv1 row is appended to an append-only
// ledger and returned. HBP-native (text/plain pipe-rows; json=0). Mirrors the
// BEHCS bus contract (/fischer/eval + /fischer/ledger.hbp).
//
//   POST /fischer/eval        text/plain HBP row OR json envelope -> FISCHERv1 row
//   GET  /fischer/ledger.hbp  the append-only ledger of every move evaluated
//   GET  /health              service heartbeat
//
// Start:  node src/fischer-live.mjs           (binds :4794)
// Env:    FISCHER_LIVE_PORT, FISCHER_LEDGER_PATH

import { createServer } from 'node:http';
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { FischerScorer } from './fischer-scorer.mjs';

const PORT = parseInt(process.env.FISCHER_LIVE_PORT || '4794', 10);

// Read the ledger path lazily so tests can isolate via FISCHER_LEDGER_PATH.
function ledgerPath() {
  return process.env.FISCHER_LEDGER_PATH || join(process.cwd(), 'data', 'fischer-live-ledger.hbp');
}

const scorer = new FischerScorer();

function sha8(s) {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
}

function parseHbpToEnvelope(row) {
  const env = {};
  for (const part of String(row).trim().split('|').slice(1)) {
    const i = part.indexOf('=');
    if (i > 0) env[part.slice(0, i)] = part.slice(i + 1);
  }
  return env;
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function sendText(res, code, body) {
  const out = body.endsWith('\n') ? body : body + '\n';
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(out) });
  res.end(out);
}

export function buildServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const p = url.pathname;

    if (p === '/health') {
      return sendText(res, 200, `FISCHER-LIVE|ok=1|port=${PORT}|ledger=${ledgerPath()}|json=0`);
    }

    if (p === '/fischer/ledger.hbp' && req.method === 'GET') {
      const LEDGER = ledgerPath();
      const body = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : '';
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body) });
      return res.end(body);
    }

    if (p === '/fischer/eval' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const trimmed = body.trim();
          const env = trimmed.startsWith('{') ? JSON.parse(trimmed) : parseHbpToEnvelope(trimmed);
          if (!env || typeof env !== 'object') throw new Error('invalid envelope');
          if (!env.verb) env.verb = 'eval';
          const pid = env.pid || `BH.FISCHER.LIVE.${sha8(trimmed)}`;
          const r = await scorer.evaluate(pid, env, { prevHash: readLastHash() });
          const row = r.fischer.row;
          const LEDGER = ledgerPath();
          ensureDir(LEDGER);
          appendFileSync(LEDGER, row + '\n', 'utf8');
          return sendText(res, 200, row);
        } catch (e) {
          return sendText(res, 500, `FISCHER-LIVE-ERROR|reason=${String(e.message || e).replace(/[|\r\n]/g, '_')}|json=0`);
        }
      });
      return;
    }

    return sendText(res, 404, 'FISCHER-LIVE|404|routes=/health,/fischer/eval,/fischer/ledger.hbp|json=0');
  });
}

function readLastHash() {
  const LEDGER = ledgerPath();
  if (!existsSync(LEDGER)) return '0000000000000000';
  const lines = readFileSync(LEDGER, 'utf8').trimEnd().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    // Kernel writes an 8-hex row_hash (sha8); accept 8..16 so the chain links.
    const m = lines[i].match(/\|row_hash=([0-9a-f]{8,16})\s*$/);
    if (m) return m[1];
  }
  return '0000000000000000';
}

// Start only when run directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fischer-live.mjs')) {
  buildServer().listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[fischer-live] listening :${PORT} · ledger=${ledgerPath()}`);
  });
}

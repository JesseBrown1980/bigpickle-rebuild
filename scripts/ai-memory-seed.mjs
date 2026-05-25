// Seed a directory of .md files into ai-memory's wiki via /hook ingress.
//
// Generalization of the acer + liris bilateral seeders 2026-05-25.
// Bug-fix preserved (liris-350-reject lesson): session_id MUST be top-level
// in JSON body (snake_case), not just URL query. Sanitizer rejects events
// lacking it AFTER returning HTTP 202 → false-green risk if shape is wrong.
//
// Usage:
//   node scripts/ai-memory-seed.mjs --dir <path> --vantage <name>
//   AI_MEMORY_SERVER_URL=http://192.168.1.50:49374 AI_MEMORY_AUTH_TOKEN=<token>

import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (k && k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1];
}

const MEMORY_DIR = args.dir || process.env.AI_MEMORY_SEED_DIR;
const VANTAGE = args.vantage || process.env.AI_MEMORY_VANTAGE || 'unknown';
const CWD = args.cwd || process.cwd();
const SERVER = process.env.AI_MEMORY_SERVER_URL || 'http://127.0.0.1:49374';
const TOKEN = process.env.AI_MEMORY_AUTH_TOKEN;

if (!MEMORY_DIR) { console.error('Usage: --dir <path> --vantage <name>'); process.exit(2); }
if (!fs.existsSync(MEMORY_DIR)) { console.error(`dir not found: ${MEMORY_DIR}`); process.exit(2); }
if (!TOKEN && !SERVER.includes('127.0.0.1')) {
  console.error('AI_MEMORY_AUTH_TOKEN required for non-loopback server'); process.exit(2);
}

const SESSION_ID = `seed-${VANTAGE}-${Date.now()}`;
const headers = { 'Content-Type': 'application/json' };
if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

async function postHook(event, payload) {
  const url = `${SERVER}/hook?event=${event}&agent=claude-code&cwd=${encodeURIComponent(CWD)}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
}

await postHook('session-start', {
  session_id: SESSION_ID, cwd: CWD, timestamp: new Date().toISOString(), vantage: VANTAGE,
});

const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md'));
console.log(`[${VANTAGE}] seeding ${files.length} files | session=${SESSION_ID} | cwd=${CWD}`);

let ok = 0, fail = 0;
const t0 = Date.now();
for (const file of files) {
  const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf8');
  const body = content.length > 8000 ? content.slice(0, 8000) + '\n\n[truncated]' : content;
  try {
    const r = await postHook('user-prompt', {
      session_id: SESSION_ID,   // CRITICAL: top-level snake_case (liris-350-reject lesson)
      cwd: CWD,
      timestamp: new Date().toISOString(),
      prompt: `[seed-${VANTAGE}] ${file}\n\n${body}`,
    });
    if (r.ok) ok++; else { fail++; if (fail <= 3) console.error(`FAIL ${file} HTTP ${r.status}`); }
  } catch (e) { fail++; if (fail <= 3) console.error(`ERR ${file} ${e.message}`); }
  await new Promise(r => setTimeout(r, 20));  // 50 ops/sec throttle (well below 429 ceiling)
}

await postHook('session-end', {
  session_id: SESSION_ID, cwd: CWD, timestamp: new Date().toISOString(),
});

const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`[${VANTAGE}] complete: ok=${ok} fail=${fail} duration=${dt}s session=${SESSION_ID}`);

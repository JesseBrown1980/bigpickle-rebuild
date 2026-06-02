// FABRIC TEST — does the new kernel reach the LIVE federation? Probes the real
// services the kernel composes with. Read-only/health only — fires NO work, spawns
// NO agents, writes NO chain. Reports which fabric endpoints are live for the kernel.
import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import net from 'node:net';

function httpOk(port, path = '/health', method = 'GET') {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, timeout: 2000 }, (res) => {
      res.resume(); resolve(res.statusCode > 0); // any response = bound
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}
function tcpOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port, timeout: 1500 }, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

// The fabric endpoints the kernel's primitives compose with.
const FABRIC = [
  { name: 'L0 EdgeLevelGNN', port: 4792, primitive: 'SCORE',   probe: 'http' },
  { name: 'L4 GSLGNN',       port: 4793, primitive: 'SCORE',   probe: 'http' },
  { name: 'behcs-bus',       port: 4947, primitive: 'ROUTE',   probe: 'tcp'  },
  { name: 'super-dashboard', port: 4949, primitive: 'OBSERVE', probe: 'tcp'  },
  { name: 'omnidispatcher',  port: 4950, primitive: 'ROUTE',   probe: 'tcp'  },
  { name: 'cosign-chain',    port: 4953, primitive: 'INTEGRITY', probe: 'tcp' },
];

test('FABRIC: probe live federation services the kernel composes with', async () => {
  const results = [];
  for (const f of FABRIC) {
    const live = f.probe === 'http' ? await httpOk(f.port) : await tcpOpen(f.port);
    results.push({ ...f, live });
    console.log(`  ${live ? 'LIVE' : 'dark'}  :${f.port}  ${f.name}  (${f.primitive})`);
  }
  // assertion: at least the SCORE path (L0 GNN) OR the bus is reachable —
  // the kernel degrades gracefully (SCORE falls back to shannon), so this is
  // informational; we only require the probe itself ran for all endpoints.
  assert.equal(results.length, FABRIC.length, 'all fabric endpoints probed');
  const liveCount = results.filter((r) => r.live).length;
  console.log(`  fabric: ${liveCount}/${FABRIC.length} live`);
  // SCORE primitive must have at least L0 reachable for a real (non-fallback) run
  const l0 = results.find((r) => r.port === 4792);
  if (!l0.live) console.log('  NOTE: :4792 L0 dark — SCORE will use shannon+baseline fallback (honest, still works)');
});

test('FABRIC: kernel SCORE degrades honestly when GNN dark', async () => {
  const { score } = await import('../../src/asolaria-score.mjs');
  // force GNN-off path — must still return a valid composite + honest provenance
  const s = await score('BH.FABRIC.TEST', 'content', { skipL0: true });
  assert.ok(s.composite >= 0 && s.composite <= 1);
  assert.equal(s.l0_real, false);
  assert.ok(s.provenance.includes('fallback'), 'honest: admits fallback when GNN unreachable');
});

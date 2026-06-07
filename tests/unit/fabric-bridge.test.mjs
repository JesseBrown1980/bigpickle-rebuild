// UNIT — fabric-bridge: parsing + the spawn gate (no live calls; mock server).
import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { routeSpawnLive } from '../../src/asolaria-fabric-bridge.mjs';

test('routeSpawnLive is DOUBLE-GATED — never fires without {live, confirmed}', async () => {
  assert.equal((await routeSpawnLive({})).fired, false);
  assert.equal((await routeSpawnLive({}, { live: true })).fired, false, 'live alone not enough');
  assert.equal((await routeSpawnLive({}, { confirmed: true })).fired, false, 'confirmed alone not enough');
  const both = await routeSpawnLive({}, { live: true, confirmed: true });
  assert.equal(both.fired, false, 'even both: body intentionally unwired (keystone staged)');
  assert.ok(both.reason.includes('not wired'));
});

test('fabricGet parses a mock dashboard health (boundary JSON -> usable)', async () => {
  const srv = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'mock-dash', uptime_s: 123 }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const { healthLive } = await import('../../src/asolaria-fabric-bridge.mjs');
  const h = await healthLive({ port });
  assert.equal(h.reachable, true);
  assert.equal(h.service, 'mock-dash');
  assert.equal(h.uptime_s, 123);
  srv.close();
});

test('fabricHealth aggregates all primitives against a mock dashboard', async () => {
  const srv = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') return res.end(JSON.stringify({ ok: true, service: 'mock', uptime_s: 9 }));
    res.end(JSON.stringify({ ok: true, route: req.url }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const { fabricHealth } = await import('../../src/asolaria-fabric-bridge.mjs');
  const fh = await fabricHealth({ port });
  assert.equal(fh.total, 4, 'ADDRESS/SCORE/HOOKWALL/ROUTE probed');
  assert.equal(fh.live_count, 4, 'all reachable on mock');
  assert.equal(fh.integrated, true, 'dashboard up => integrable');
  srv.close();
});

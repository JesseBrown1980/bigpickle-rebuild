// SYSTEM — fabric-bridge against the LIVE :4949 federation (read-only, no spawns).
// Verifies the new kernel can REACH and READ the running Codex-built body.
// Fires NO agents, writes NO chain. Skips gracefully if :4949 is down.
import { test } from 'node:test';
import assert from 'node:assert';
import { fabricHealth, healthLive } from '../../src/asolaria-fabric-bridge.mjs';

test('SYSTEM: kernel reaches the live :4949 federation dashboard', async (t) => {
  const h = await healthLive({});
  if (!h.reachable) return t.skip(':4949 dashboard not live');
  assert.ok(h.reachable, 'dashboard reachable');
  console.log(`  :4949 service=${h.service} uptime_s=${h.uptime_s}`);
});

test('SYSTEM: fabricHealth maps all primitives onto the live body (read-only)', async (t) => {
  const fh = await fabricHealth({});
  if (!fh.integrated) return t.skip(':4949 not live — cannot integration-probe');
  assert.equal(fh.total, 4);
  for (const p of fh.primitives) {
    console.log(`  ${p.reachable ? 'REACHABLE' : 'dark'}  ${p.primitive} -> ${p.endpoint}`);
  }
  assert.ok(fh.integrated, 'kernel can integrate into the live body');
  assert.ok(fh.live_count >= 1, 'at least one primitive endpoint reachable');
});

test('SYSTEM: real-agent spawn stays STAGED even against the live system', async () => {
  const { routeSpawnLive } = await import('../../src/asolaria-fabric-bridge.mjs');
  // even with live:true, no confirmed => never fires; and body unwired regardless
  const r = await routeSpawnLive({ pid: 'BH.TEST' }, { live: true });
  assert.equal(r.fired, false, 'live free-agent run remains staged (operator-gated)');
});

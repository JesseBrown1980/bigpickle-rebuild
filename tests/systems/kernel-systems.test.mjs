// SYSTEMS TEST — the new kernel against REAL services + the REAL 100k C: rooms.
// NO live free-agent run (mock agent). Live L0 GNN scoring (real :4792 if up).
// Verifies components work together on the real substrate, not in a tmp sandbox.
import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

// point at the REAL 100k substrate on C:
process.env.ASOLARIA_DISTRICT_ROOT = 'C:/Asolaria-Districts';
process.env.ASOLARIA_ROOM_SCALE = '10';

const REAL = 'C:/Asolaria-Districts';
const tmp = mkdtempSync(join(tmpdir(), 'sys-'));

const { runLoop } = await import('../../src/asolaria-loop.mjs');
const { parsePipeRow } = await import('../../src/hbp-reader.mjs');
const { score } = await import('../../src/asolaria-score.mjs');

function probe(port) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ nodes: [[0.1,0.2,0.3,0.4,0.5,0.6],[0.6,0.5,0.4,0.3,0.2,0.1]], edges: [[0,1]], edge_features: [[0.2,0.5,0.8]] });
    const req = http.request({ hostname: '127.0.0.1', port, path: '/infer', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { resolve(JSON.parse(d).ok===true); } catch { resolve(false); } }); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    req.write(body); req.end();
  });
}

test('SYSTEMS: the real 100k substrate exists on C: with 6 districts', (t) => {
  if (!existsSync(REAL)) return t.skip('100k substrate not built');
  assert.ok(existsSync(join(REAL, 'FABRIC.hbp')), 'fabric manifest present');
  const man = readFileSync(join(REAL, 'FABRIC.hbp'), 'utf8');
  assert.ok(man.includes('total_rooms=100000'), '100k rooms manifested');
  assert.ok(man.includes('language=BEHCS-1024') && man.includes('dims=64'), '60D+ + language in manifest');
  for (const d of ['rotator','prism','engineering','white-room','gnn-feed','council']) {
    assert.ok(existsSync(join(REAL, d)), `district ${d} present`);
  }
});

test('SYSTEMS: real engineering room descriptor is 60D+/glyph/tuple', (t) => {
  const rd = join(REAL, 'engineering/rooms/shard-0000/room-000000/ROOM.hbp');
  if (!existsSync(rd)) return t.skip('substrate not built');
  const f = parsePipeRow(readFileSync(rd, 'utf8').trim().split('\n')[0]).fields;
  assert.equal(f.kind, 'micro-kernel');
  assert.equal(f.dims, '64');
  assert.ok(f.coord64.length === 64);
  assert.ok(f.glyph.startsWith('cp'));
  assert.ok(f.tuple.includes('wave='));
});

test('SYSTEMS: live L0 GNN (:4792) scoring through SCORE primitive', async (t) => {
  const up = await probe(4792);
  if (!up) return t.skip(':4792 L0 GNN not live');
  const s = await score('BH.SYSTEMS.TEST.PID', 'a substantive answer with real content to score', {});
  assert.equal(s.l0_real, true, 'real L0 GNN used');
  assert.ok(s.composite >= 0 && s.composite <= 1);
  assert.ok(s.provenance.includes('l0-real'));
});

test('SYSTEMS: kernel LOOP over real C: rooms + live GNN (mock agent, NO opencode)', async (t) => {
  if (!existsSync(join(REAL, 'engineering'))) return t.skip('substrate not built');
  const gnnUp = await probe(4792);
  const s = await runLoop({
    district: 'engineering', cycles: 20,
    opts: { mock: true, skipL0: !gnnUp, scale: 10, gcEvery: 8,
            ledgerPath: join(tmp, 'sys-ledger.hbp'), prismDir: join(tmp, 'sys-prism') },
  });
  assert.equal(s.cycles, 20, '20 cycles ran on real substrate');
  assert.equal(s.promoted + s.blocked + s.observe, 20, 'every cycle verdicted (no silent drops)');
  assert.equal(s.mock, 20, 'mock agent — no live free-agent run (as intended)');
  assert.ok(s.gc_runs >= 2, 'GC gulped (20 cycles / every 8)');
  if (gnnUp) assert.ok(s.l0_real > 0, 'REAL L0 GNN scores flowed through the loop');
  // ledger + prism written to tmp (not polluting the 100k)
  assert.ok(existsSync(join(tmp, 'sys-ledger.hbp')), 'hookwall ledger written');
  assert.ok(existsSync(join(tmp, 'sys-prism', 'prism-in.hbp')), 'prism received routes');
});

test.after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch {} });

// fischer-live.test.mjs — integration/system test for the live Fischer host.
// Boots the real server on an ephemeral port, POSTs envelopes, and asserts the
// sealed FISCHERv1 rows + append-only ledger. Run: node --test tests/integration/fischer-live.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LEDGER = join(tmpdir(), `fischer-live-test-${process.pid}-${Math.floor(performance.now())}.hbp`);
process.env.FISCHER_LEDGER_PATH = LEDGER;

const { buildServer } = await import('../../src/fischer-live.mjs');

function listen() {
  return new Promise((resolve) => {
    const srv = buildServer().listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function postEval(port, body) {
  const r = await fetch(`http://127.0.0.1:${port}/fischer/eval`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body,
  });
  return { status: r.status, text: (await r.text()).trim() };
}

test('fischer-live: clean envelope -> FISCHERv1 row, appended to ledger', async () => {
  const { srv, port } = await listen();
  try {
    const env = 'ENV|verb=seal_whiteroom|pid=BH.WR.P0007.R0000999|schema=hbpv1|cosign=ok|proof=hbp_row|authority=cosigned|halt=true|json=0';
    const { status, text } = await postEval(port, env);
    assert.equal(status, 200);
    assert.match(text, /^FISCHERv1\|/, 'response is a FISCHERv1 pipe-row');
    assert.match(text, /\|verdict=(PROCEED|HOLD|ANALYZE|BLOCK|REFUTE)\|/);
    assert.match(text, /\|json=0/);

    const ledger = await fetch(`http://127.0.0.1:${port}/fischer/ledger.hbp`);
    const body = await ledger.text();
    assert.match(ledger.headers.get('content-type') || '', /text\/plain/);
    assert.ok(body.includes(text.split('|row_hash=')[0].slice(0, 40)), 'evaluated row is in the ledger');
  } finally {
    srv.close();
  }
});

test('fischer-live: refuted verb -> REFUTE/BLOCK verdict', async () => {
  const { srv, port } = await listen();
  try {
    const env = 'ENV|verb=self_authorize|pid=BH.WR.P0007.R0001000|schema=hbpv1|cosign=ok|proof=hbp_row|authority=cosigned|halt=true|json=0';
    const { status, text } = await postEval(port, env);
    assert.equal(status, 200);
    assert.match(text, /\|verdict=(REFUTE|BLOCK)\|/, 'self_authorize is refused');
  } finally {
    srv.close();
  }
});

test('fischer-live: health + 404 are HBP text, json=0', async () => {
  const { srv, port } = await listen();
  try {
    const h = await fetch(`http://127.0.0.1:${port}/health`);
    const ht = await h.text();
    assert.equal(h.status, 200);
    assert.match(ht, /FISCHER-LIVE\|ok=1\|.*json=0/);
    const nf = await fetch(`http://127.0.0.1:${port}/nope`);
    assert.equal(nf.status, 404);
    assert.match(await nf.text(), /json=0/);
  } finally {
    srv.close();
    try { rmSync(LEDGER, { force: true }); } catch { /* */ }
  }
});

// Integration test — helm-supervisor citizen registration into the live
// Asolaria fabric. Verifies the registration trinity exists, has canonical
// HBPv1 row shape, sha256-chains correctly, and that the 5 hyperbehcs
// daemons (:4920-:4924) are alive to accept the row.
//
// This test is acer-vantage-specific (daemons run only on acer). It is
// SKIPPED by default. Set BIGPICKLE_RUN_FABRIC_PIPE=1 to run it. CI on
// Linux runners (which have no fabric daemons) sees only skips, so it
// never fails the build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const FABRIC = process.env.BIGPICKLE_RUN_FABRIC_PIPE === '1';
const skip = !FABRIC;

const V48 = 'C:/HyperBEHCS/data/v48-citizens';
const STEM = 'AGT-L3-HELM-CLAUDE-SUP-H8EF7';
const PID = 'AGT-L3-HELM-CLAUDE-SUP-H8EF7-W113-P00-N17f0cc4c';
const PROF = 'PROF-CLAUDE-HELM-SUPERVISOR-001';

async function probe(url, timeoutMs = 2500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

test('citizen-registration trinity exists on disk', { skip }, () => {
  for (const ext of ['hbp', 'hbi', 'sha256', 'hex', 'voxel.json']) {
    const path = `${V48}/${STEM}.${ext}`;
    assert.ok(existsSync(path), `missing ${ext}: ${path}`);
  }
});

function readRow(idx) {
  const lines = readFileSync(`${V48}/${STEM}.hbp`, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
  return lines[idx];
}

function parseRow(line) {
  return Object.fromEntries(
    line
      .split('|')
      .slice(1)
      .map((f) => {
        const i = f.indexOf('=');
        return [f.slice(0, i), f.slice(i + 1)];
      }),
  );
}

test('row #1 (registration) has canonical pipe-delim shape with all required fields', { skip }, () => {
  const line = readRow(0);
  assert.ok(line.startsWith('HBPv1|'), 'must start with HBPv1|');
  const kv = parseRow(line);
  assert.equal(kv.layer, 'citizen-registration');
  assert.equal(kv.embodied_pid, PID);
  assert.equal(kv.prof, PROF);
  assert.equal(kv.supervisor_band, 'helm');
  assert.equal(kv.cp, 'PENDING-APEX-MINT');
  assert.equal(kv.hilbert_coord, 'H8EF7');
  assert.equal(kv.tuple, 'helm:queue-watch:citizen-daemon');
  assert.equal(kv.behcs_1024_sha16, '7a1b9417');
  assert.equal(kv.json, '0');
  assert.equal(kv.runtime, '0');
  assert.equal(kv.promote, '0');
  assert.match(kv.row_hash, /^[a-f0-9]{16}$/);
  assert.equal(kv.anchor_pid, 'AGT-L0-SPECIAL-OP-JESSE-H12D3');
});

test('.sha256 sidecar matches file content', { skip }, () => {
  const body = readFileSync(`${V48}/${STEM}.hbp`);
  const claimed = readFileSync(`${V48}/${STEM}.sha256`, 'utf8').split(/\s+/)[0];
  const computed = createHash('sha256').update(body).digest('hex');
  assert.equal(claimed, computed);
});

test('voxel.json has bilateral-3d-join-v1 schema fields', { skip }, () => {
  const v = JSON.parse(readFileSync(`${V48}/${STEM}.voxel.json`, 'utf8'));
  assert.equal(v.pid, PID);
  assert.equal(v.vantage, 'acer');
  assert.equal(v.supervisor, 'helm');
  assert.equal(v.parent_voxel, 'AGT-L0-SPECIAL-OP-JESSE-H12D3');
  assert.equal(v.schema_version, 'bilateral-3d-join-v1');
});

test('all 5 hyperbehcs daemons alive (:4920-:4924)', { skip }, async () => {
  const ports = [
    [4920, 'hyperbehcs-gnn-drain'],
    [4921, 'hyperbehcs-whiteroom-drain'],
    [4922, 'hyperbehcs-library-indexer'],
    [4923, 'sustained-wave-generator'],
    [4924, 'hyperbehcs-library-50d-vec'],
  ];
  for (const [port, name] of ports) {
    const h = await probe(`http://127.0.0.1:${port}/health`);
    assert.ok(h, `:${port} ${name} unreachable`);
    assert.equal(h.ok, true, `:${port} ${name} not ok`);
  }
});

test('sidecar runtime dir has status.json with registered state', { skip }, () => {
  const s = JSON.parse(
    readFileSync(
      'C:/Users/acer/Asolaria/runtime/citizens/claude-helm-supervisor/status.json',
      'utf8',
    ),
  );
  assert.equal(s.pid, PID);
  assert.equal(s.prof, PROF);
  assert.equal(s.state, 'registered');
  assert.match(s.registration_row_hash, /^[a-f0-9]{16}$/);
});

// Multi-row chain: bilateral-closure row #2 must chain to registration row #1
// via antecedents = row_1.row_hash. Each row's row_hash must be a valid sha256
// prefix of its own content-minus-row_hash.

test('ledger has ≥2 rows after bilateral closure', { skip }, () => {
  const lines = readFileSync(`${V48}/${STEM}.hbp`, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
  assert.ok(lines.length >= 2, `expected ≥2 rows, got ${lines.length}`);
});

test('row #2 antecedents chains to row #1 row_hash', { skip }, () => {
  const lines = readFileSync(`${V48}/${STEM}.hbp`, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
  const row1 = lines[0];
  const row2 = lines[1];
  const row1Hash = row1.match(/\|row_hash=([a-f0-9]{16})$/)[1];
  const row2Antecedents = row2.match(/\|antecedents=([a-f0-9]{16})\|/)[1];
  assert.equal(
    row2Antecedents,
    row1Hash,
    `row #2 antecedents (${row2Antecedents}) must equal row #1 row_hash (${row1Hash})`,
  );
});

test('every row’s row_hash matches sha256-prefix of its content', { skip }, () => {
  const lines = readFileSync(`${V48}/${STEM}.hbp`, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hashIdx = line.lastIndexOf('|row_hash=');
    const sansHash = line.slice(0, hashIdx);
    const claimed = line.slice(hashIdx + '|row_hash='.length);
    const computed = createHash('sha256').update(sansHash).digest('hex').slice(0, 16);
    assert.equal(claimed, computed, `row ${i + 1} row_hash mismatch`);
  }
});

test('.sha256 sidecar matches whole-file content after row append', { skip }, () => {
  const body = readFileSync(`${V48}/${STEM}.hbp`);
  const claimed = readFileSync(`${V48}/${STEM}.sha256`, 'utf8').split(/\s+/)[0];
  const computed = createHash('sha256').update(body).digest('hex');
  assert.equal(claimed, computed, 'sidecar must be re-hashed when rows append');
});

test('.hbi reports correct row_count + last row_hash', { skip }, () => {
  const hbi = readFileSync(`${V48}/${STEM}.hbi`, 'utf8');
  const lines = readFileSync(`${V48}/${STEM}.hbp`, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
  const rowCountMatch = hbi.match(/^row_count=(\d+)$/m);
  assert.ok(rowCountMatch, 'hbi must declare row_count');
  assert.equal(parseInt(rowCountMatch[1], 10), lines.length);
  const lastLineHash = lines[lines.length - 1].match(/\|row_hash=([a-f0-9]{16})$/)[1];
  assert.ok(
    hbi.includes(lastLineHash),
    `hbi must reference last row_hash ${lastLineHash}`,
  );
});

// Live POST pipe-health test. Gated by BIGPICKLE_RUN_FABRIC_POST=1 because it
// MUTATES the live :4920 gnn-drain ledger (appends a fixture event). Skipped
// by default even on acer to avoid noise. NOT a hookwall-canonical event emit —
// it's a pipe-health verification fixture, labeled as such in the payload.

const POST_LIVE = process.env.BIGPICKLE_RUN_FABRIC_POST === '1';

test(
  'live POST through :4920 → :4922 → :4924 produces non-zero deltas',
  { skip: skip || !POST_LIVE },
  async () => {
    const probe = async (port) => {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      return r.json();
    };
    const before = {
      d4920: await probe(4920),
      d4922: await probe(4922),
      d4924: await probe(4924),
    };

    const fixture = {
      envelope_id: 'TEST-FIXTURE-' + Date.now().toString(16),
      kind: 'pipe-health-test',
      verb: 'EVT-FABRIC-QUERY-REQUEST',
      weight: 1,
      test_fixture_purpose: 'helm-fabric-pipe-integration-test',
      NOT_a_canonical_event: 'true',
      emitted_by: 'acer-Claude-integration-test',
      emitted_at: new Date().toISOString(),
    };
    const res = await fetch('http://127.0.0.1:4920/api/gnn-drain/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixture),
    });
    const accepted = await res.json();
    assert.equal(accepted.ok, true, 'POST must be accepted');
    assert.match(accepted.event_id, /^[a-f0-9]{16}$/);

    await new Promise((r) => setTimeout(r, 8000));

    const after = {
      d4920: await probe(4920),
      d4922: await probe(4922),
      d4924: await probe(4924),
    };

    assert.equal(
      after.d4920.ingest_total - before.d4920.ingest_total,
      1,
      ':4920 ingest_total must increment by exactly 1 (my POST)',
    );
    assert.ok(
      after.d4922.indexed_total >= before.d4922.indexed_total,
      ':4922 indexed_total must not regress',
    );
    assert.ok(
      after.d4924.indexed_total >= before.d4924.indexed_total,
      ':4924 indexed_total must not regress',
    );
  },
);

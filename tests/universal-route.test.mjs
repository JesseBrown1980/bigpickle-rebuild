// Universal-route dual-emit observation tests.
// Verifies: fail-soft writes, subnet_h defaulting, schema shape, opt-out flag.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dualEmitObservation, STATUS, EDGE_CLASSES, SOURCE_CLASSES, AUTHORITY_LEVELS, IMAGE_CLASSES } from '../src/universal-route.mjs';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'universal-route-test-'));
}

describe('universal-route — STATUS surface', () => {
  test('exposes schema + defaults + canon refs', () => {
    assert.equal(STATUS.schema, 'universal-route.v1');
    assert.equal(STATUS.default_subnet_h, 'H9100');
    assert.equal(STATUS.fail_soft, true);
    assert.ok(STATUS.canon_refs.length >= 3);
  });
});

describe('universal-route — dualEmitObservation writes both lanes', () => {
  test('writes hookwall + gnn rows to configurable paths', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    const result = dualEmitObservation(
      { event: 'tick', vantage: 'liris' },
      { seq: 42, row_hash: 'abc123', antecedent_prev: 'def456' },
      { hookwallPath, gnnEdgesPath, channel: 'omni-asolaria/liris/test' },
    );
    assert.equal(result.both_lanes_ok, true);
    assert.equal(result.hookwall.ok, true);
    assert.equal(result.gnn_edges.ok, true);

    const hookwallRow = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    assert.equal(hookwallRow.schema, 'hookwall-observation.v1');
    assert.equal(hookwallRow.cosign_seq, 42);
    assert.equal(hookwallRow.event, 'tick');
    assert.equal(hookwallRow.vantage, 'liris');
    assert.equal(hookwallRow.subnet_h, 'H9100');

    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(gnnRow.schema, 'gnn-live-edge.v1');
    assert.equal(gnnRow.cosign_seq, 42);
    assert.equal(gnnRow.verb, 'tick');
    assert.equal(gnnRow.weight, 1.0);
    assert.equal(gnnRow.subnet_h, 'H9100');
  });

  test('respects custom subnet_h tag', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'wave-closure' },
      { seq: 1, row_hash: 'x', antecedent_prev: 'y' },
      { hookwallPath, gnnEdgesPath, channel: 'test', subnet_h: 'H9101' },
    );
    const hookwallRow = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    assert.equal(hookwallRow.subnet_h, 'H9101');
  });

  test('appends multiple rows (NDJSON)', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    for (let i = 0; i < 3; i++) {
      dualEmitObservation(
        { event: 'tick', vantage: 'acer' },
        { seq: i, row_hash: `r${i}`, antecedent_prev: i > 0 ? `r${i - 1}` : null },
        { hookwallPath, gnnEdgesPath, channel: 'test' },
      );
    }
    const lines = fs.readFileSync(hookwallPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[2]).cosign_seq, 2);
  });

  test('fail-soft: returns ok=false but does not throw on unwritable path', () => {
    // Cross-platform unwritable: create a file, then try to use it AS a directory.
    const dir = tmpdir();
    const blockerFile = path.join(dir, 'blocker');
    fs.writeFileSync(blockerFile, 'occupied');
    const result = dualEmitObservation(
      { event: 'tick' },
      { seq: 1, row_hash: 'x' },
      {
        hookwallPath: path.join(blockerFile, 'cannot-be-dir', 'hookwall.ndjson'),
        gnnEdgesPath: path.join(blockerFile, 'cannot-be-dir', 'gnn.ndjson'),
        channel: 'test',
      },
    );
    assert.equal(result.both_lanes_ok, false);
    assert.equal(result.hookwall.ok, false);
    assert.ok(result.hookwall.error);
  });
});

describe('universal-route — payload edge cases', () => {
  test('handles null payload gracefully', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    const result = dualEmitObservation(null, { seq: 1, row_hash: 'x' }, { hookwallPath, gnnEdgesPath, channel: 'test' });
    assert.equal(result.both_lanes_ok, true);
    const row = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    assert.equal(row.event, null);
    assert.equal(row.vantage, null);
  });

  test('handles missing cosign gracefully', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    const result = dualEmitObservation({ event: 'tick' }, null, { hookwallPath, gnnEdgesPath, channel: 'test' });
    assert.equal(result.both_lanes_ok, true);
    const row = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    assert.equal(row.cosign_seq, null);
  });

  test('custom GNN edge fields override defaults', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'mint' },
      { seq: 99, row_hash: 'q' },
      {
        hookwallPath,
        gnnEdgesPath,
        channel: 'test',
        gnnFrom: 'pid_minter',
        gnnTo: 'whiteroom_skill_mint',
        gnnVerb: 'distill',
        gnnWeight: 0.96,
      },
    );
    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(gnnRow.from, 'pid_minter');
    assert.equal(gnnRow.to, 'whiteroom_skill_mint');
    assert.equal(gnnRow.verb, 'distill');
    assert.equal(gnnRow.weight, 0.96);
  });
});

describe('universal-route — Dan-fix-5 edgeClass split (proof / prediction / action)', () => {
  test('EDGE_CLASSES export surface', () => {
    assert.equal(EDGE_CLASSES.PROOF, 'proof_edge');
    assert.equal(EDGE_CLASSES.PREDICTION, 'prediction_edge');
    assert.equal(EDGE_CLASSES.ACTION, 'action_edge');
    assert.equal(STATUS.default_edge_class, 'proof_edge');
  });

  test('default edgeClass is proof_edge (backward-compat)', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation({ event: 'observe' }, { seq: 1, row_hash: 'a' }, { hookwallPath, gnnEdgesPath, channel: 'test' });
    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(gnnRow.edgeClass, 'proof_edge');
  });

  test('explicit prediction_edge tags GNN row correctly', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'gnn_infer_next' },
      { seq: 2, row_hash: 'b' },
      { hookwallPath, gnnEdgesPath, channel: 'test', edgeClass: EDGE_CLASSES.PREDICTION },
    );
    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(gnnRow.edgeClass, 'prediction_edge');
  });

  test('explicit action_edge tags GNN row correctly', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'runtime_mutation' },
      { seq: 3, row_hash: 'c' },
      { hookwallPath, gnnEdgesPath, channel: 'test', edgeClass: EDGE_CLASSES.ACTION },
    );
    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(gnnRow.edgeClass, 'action_edge');
  });

  test('invalid edgeClass throws RangeError', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    assert.throws(
      () => dualEmitObservation(
        { event: 'bad' },
        { seq: 4, row_hash: 'd' },
        { hookwallPath, gnnEdgesPath, channel: 'test', edgeClass: 'invalid_class' },
      ),
      RangeError,
    );
  });
});

describe('universal-route — Dan-fix-1 sourceClass (backend_rows_before_pixels)', () => {
  test('SOURCE_CLASSES export surface', () => {
    assert.equal(SOURCE_CLASSES.BACKEND_ROW, 'backend_row');
    assert.equal(SOURCE_CLASSES.PIXEL_SCREENSHOT, 'pixel_screenshot');
    assert.equal(SOURCE_CLASSES.LEGACY_IMAGE, 'legacy_image');
    assert.equal(STATUS.default_source_class, 'backend_row');
  });

  test('default sourceClass = backend_row tagged on both rows', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation({ event: 'observe' }, { seq: 1, row_hash: 'a' }, { hookwallPath, gnnEdgesPath, channel: 'test' });
    const hookwallRow = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    const gnnRow = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(hookwallRow.sourceClass, 'backend_row');
    assert.equal(gnnRow.sourceClass, 'backend_row');
  });

  test('pixel_screenshot without backendRowPid throws Error', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    assert.throws(
      () => dualEmitObservation(
        { event: 'screenshot' },
        { seq: 2, row_hash: 'b' },
        { hookwallPath, gnnEdgesPath, channel: 'test', sourceClass: SOURCE_CLASSES.PIXEL_SCREENSHOT },
      ),
      /backendRowPid/,
    );
  });

  test('pixel_screenshot with backendRowPid is accepted', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'screenshot' },
      { seq: 2, row_hash: 'b' },
      { hookwallPath, gnnEdgesPath, channel: 'test', sourceClass: SOURCE_CLASSES.PIXEL_SCREENSHOT, backendRowPid: 'BH.ROW.PID.000001' },
    );
    const row = JSON.parse(fs.readFileSync(hookwallPath, 'utf8').trim());
    assert.equal(row.sourceClass, 'pixel_screenshot');
    assert.equal(row.backendRowPid, 'BH.ROW.PID.000001');
  });

  test('invalid sourceClass throws RangeError', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    assert.throws(
      () => dualEmitObservation(
        { event: 'x' }, { seq: 3, row_hash: 'c' },
        { hookwallPath, gnnEdgesPath, channel: 'test', sourceClass: 'bogus' },
      ),
      RangeError,
    );
  });
});

describe('universal-route — Dan-fix-9 authorityLevel (authority_levels_visible)', () => {
  test('AUTHORITY_LEVELS export surface', () => {
    assert.equal(AUTHORITY_LEVELS.PRE_DEV, 'pre-dev');
    assert.equal(AUTHORITY_LEVELS.DEV, 'dev');
    assert.equal(AUTHORITY_LEVELS.STAGING, 'staging');
    assert.equal(AUTHORITY_LEVELS.PROD, 'prod');
    assert.equal(STATUS.default_authority_level, 'dev');
  });

  test('default authorityLevel = dev tagged on both rows', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation({ event: 'x' }, { seq: 1, row_hash: 'a' }, { hookwallPath, gnnEdgesPath, channel: 'test' });
    const row = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(row.authorityLevel, 'dev');
  });

  test('explicit prod authorityLevel tagged correctly', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'x' }, { seq: 1, row_hash: 'a' },
      { hookwallPath, gnnEdgesPath, channel: 'test', authorityLevel: AUTHORITY_LEVELS.PROD },
    );
    const row = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(row.authorityLevel, 'prod');
  });

  test('invalid authorityLevel throws RangeError', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    assert.throws(
      () => dualEmitObservation(
        { event: 'x' }, { seq: 1, row_hash: 'a' },
        { hookwallPath, gnnEdgesPath, channel: 'test', authorityLevel: 'rogue' },
      ),
      RangeError,
    );
  });
});

describe('universal-route — Dan-fix-10 imageClass (legacy_image_is_evidence_not_runtime)', () => {
  test('IMAGE_CLASSES export surface', () => {
    assert.equal(IMAGE_CLASSES.RUNTIME_PROOF, 'runtime_proof');
    assert.equal(IMAGE_CLASSES.HISTORICAL_EVIDENCE, 'historical_evidence');
    assert.equal(IMAGE_CLASSES.NONE, 'none');
    assert.equal(STATUS.default_image_class, 'none');
  });

  test('default imageClass = none on both rows', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation({ event: 'x' }, { seq: 1, row_hash: 'a' }, { hookwallPath, gnnEdgesPath, channel: 'test' });
    const row = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(row.imageClass, 'none');
  });

  test('historical_evidence tag accepted', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    dualEmitObservation(
      { event: 'dan_image' }, { seq: 1, row_hash: 'a' },
      { hookwallPath, gnnEdgesPath, channel: 'test', imageClass: IMAGE_CLASSES.HISTORICAL_EVIDENCE },
    );
    const row = JSON.parse(fs.readFileSync(gnnEdgesPath, 'utf8').trim());
    assert.equal(row.imageClass, 'historical_evidence');
  });

  test('invalid imageClass throws RangeError', () => {
    const dir = tmpdir();
    const hookwallPath = path.join(dir, 'hookwall.ndjson');
    const gnnEdgesPath = path.join(dir, 'gnn-edges.ndjson');
    assert.throws(
      () => dualEmitObservation(
        { event: 'x' }, { seq: 1, row_hash: 'a' },
        { hookwallPath, gnnEdgesPath, channel: 'test', imageClass: 'meme' },
      ),
      RangeError,
    );
  });
});

// Unit tests for hbp-reader.mjs — the symmetric read/verify half of hbp-emitter.
// Round-trips against the REAL emitter, verifies sidecars, parses pipe rows, detects tamper.
import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeHBP, serializeEnvelope } from '../../src/hbp-emitter.mjs';
import {
  detectFormat, parsePipeRow, parsePipeFile,
  parseEnvelope, readHBP, verifyHBP, decodeQuant,
} from '../../src/hbp-reader.mjs';

const dir = mkdtempSync(join(tmpdir(), 'hbp-reader-'));

test('detectFormat distinguishes the formats', () => {
  assert.equal(detectFormat('!HBP-v0 message\ntype=message'), 'hbp-v0-envelope');
  assert.equal(detectFormat('!HBI-v0\npacket=x.hbp'), 'hbi-v0-index');
  assert.equal(detectFormat('HBPv1|row=room_question|pid=BH.ROOM.00000'), 'hbpv1-pipe');
  assert.equal(detectFormat('HBI1|task=foo'), 'hbi1-pipe');
  assert.equal(detectFormat('plain text'), 'unknown');
});

test('parsePipeRow decodes a real room-question row', () => {
  const row = 'HBPv1|row=room_question|pid=BH.ROOM.05001.6A4260240CA0EAC8|glyph=natural|cp=905|lane=remote_tracker_first|crypto_token=4c545764fdb3eda6|json=0';
  const { tag, fields } = parsePipeRow(row);
  assert.equal(tag, 'HBPv1');
  assert.equal(fields.row, 'room_question');
  assert.equal(fields.pid, 'BH.ROOM.05001.6A4260240CA0EAC8');
  assert.equal(fields.cp, '905');
  assert.equal(fields.lane, 'remote_tracker_first');
  assert.equal(fields.crypto_token, '4c545764fdb3eda6');
});

test('parsePipeFile handles multi-row ledgers + skips blanks', () => {
  const text = 'HBPv1|a=1|b=2\n\nGNN-EDGE|from=x|to=y|weight=1.0\n';
  const rows = parsePipeFile(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fields.a, '1');
  assert.equal(rows[1].tag, 'GNN-EDGE');
  assert.equal(rows[1].fields.weight, '1.0');
});

test('parseEnvelope round-trips the emitter serialize format', () => {
  const env = {
    type: 'room-answer',
    tupleTag: ['acer', 'helm', 'G', 'free-agent', '7', 'scout'],
    payload: 'the answer text for this lane',
    metadata: { lane: 'claim_quarantine', score: 0.87 },
  };
  const text = serializeEnvelope(env);
  const parsed = parseEnvelope(text);
  assert.equal(parsed.type, 'room-answer');
  assert.deepEqual(parsed.tupleTag.slice(0, 6), env.tupleTag);
  assert.equal(parsed.payload, 'the answer text for this lane');
  assert.equal(parsed.metadata.lane, 'claim_quarantine');
  assert.equal(parsed.metadata.score, 0.87);
});

test('readHBP + verifyHBP: full trinity round-trip with real writeHBP', () => {
  const dest = join(dir, 'sample');
  const env = {
    type: 'room-question',
    tupleTag: ['acer', 'vector', 'O', 'citizen', '3', 'evidence'],
    payload: 'What is the current status and risk for this lane?',
    metadata: { pid: 'BH.ROOM.00042', cp: 42 },
  };
  const w = writeHBP(dest, env);

  // read back
  const r = readHBP(w.hbp);
  assert.equal(r.format, 'hbp-v0-envelope');
  assert.equal(r.envelope.type, 'room-question');
  assert.equal(r.envelope.payload, 'What is the current status and risk for this lane?');
  assert.equal(r.envelope.metadata.pid, 'BH.ROOM.00042');

  // verify sidecars all pass
  const v = verifyHBP(w.hbp);
  assert.equal(v.sha_ok, true, 'sha256 sidecar must verify');
  assert.equal(v.hex_ok, true, 'hex sidecar must round-trip');
  assert.equal(v.hbi_ok, true, 'hbi index must match');
  assert.equal(v.ok, true);
  assert.equal(v.sha256, w.sha, 'recomputed sha must equal emitter sha');
});

test('verifyHBP DETECTS tampering (sha mismatch after edit)', () => {
  const dest = join(dir, 'tamper');
  const w = writeHBP(dest, { type: 'x', payload: 'original' });
  // tamper with the .hbp bytes, leave sidecars stale
  const body = readFileSync(w.hbp, 'utf8').replace('original', 'TAMPERED');
  writeFileSync(w.hbp, body, 'utf8');

  const v = verifyHBP(w.hbp);
  assert.equal(v.sha_ok, false, 'tamper must be caught by sha');
  assert.equal(v.hex_ok, false, 'tamper must be caught by hex');
  assert.equal(v.ok, false);
  assert.ok(v.errors.length >= 1);
});

test('decodeQuant stub passes through without crashing', () => {
  const d = decodeQuant('0.529');
  assert.equal(d.decoded, '0.529');
  assert.equal(d.quant, 'passthrough');
});

test.after(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

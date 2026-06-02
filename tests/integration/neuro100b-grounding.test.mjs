// INTEGRATION — ground the codified 100B metrics against the REAL artifacts on C:.
// Confirms the permanent record reflects what's actually on disk (genius/mistake
// totals from the cube.js, the 10 top-glyph entries, the 121-pointer MCP catalog).
// Skips gracefully when the C: federation artifacts aren't present (portable CI).
import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HARVEST } from '../../src/neuro100b-metrics.mjs';

const BEHCS = 'C:/Users/acer/Asolaria/data/behcs';
const CUBES = join(BEHCS, 'cubes');

test('GROUND: cube.js carries the codified genius/mistake/scale totals', (t) => {
  if (!existsSync(CUBES)) return t.skip('C: federation artifacts not present');
  const files = readdirSync(CUBES).filter((f) => /neurotech.*100b.*\.cube\.js$/.test(f));
  if (!files.length) return t.skip('no 100B cube.js on disk');
  const blob = files.map((f) => { try { return readFileSync(join(CUBES, f), 'utf8'); } catch { return ''; } }).join('\n');
  assert.ok(blob.includes(String(HARVEST.genius_marks)), `genius ${HARVEST.genius_marks} present on disk`);
  assert.ok(blob.includes(String(HARVEST.mistake_marks)), `mistake ${HARVEST.mistake_marks} present on disk`);
  assert.ok(blob.includes(String(HARVEST.scale)), `scale ${HARVEST.scale} present on disk`);
});

test('GROUND: glyph cubes hold exactly the codified 10 top entries (5 genius + 5 mistake)', (t) => {
  if (!existsSync(CUBES)) return t.skip('C: federation artifacts not present');
  const cube = join(CUBES, 'blast-100b-glyph-1024-latest.ndjson');
  if (!existsSync(cube)) return t.skip('glyph cube not on disk');
  const txt = readFileSync(cube, 'utf8');
  const entries = new Set((txt.match(/blast-100b:(genius|mistake):[a-z_0-9]+/g) || []));
  const genius = [...entries].filter((e) => e.includes(':genius:')).length;
  const mistake = [...entries].filter((e) => e.includes(':mistake:')).length;
  assert.equal(entries.size, HARVEST.materialized.top_glyph_cubes, '10 distinct top entries');
  assert.equal(genius, 5, '5 genius'); assert.equal(mistake, 5, '5 mistake');
});

test('GROUND: MCP catalog has the codified 121 sti:// pointers', (t) => {
  const ledger = join(BEHCS, 'mcp-catalog/skills-tools-pointer-shards-20260515/skills-tools-pointer-ledger-latest.ndjson');
  if (!existsSync(ledger)) return t.skip('MCP catalog not on disk');
  const lines = readFileSync(ledger, 'utf8').trim().split('\n').filter((l) => l.includes('sti://'));
  assert.equal(lines.length, HARVEST.mcp_catalog.sti_pointers, `${HARVEST.mcp_catalog.sti_pointers} registered pointers`);
});

// New-tech subsystem core functions (extracted from new-tech-subsystems-2026-05-28.mjs).
// Pure functions for unit + integration testing.
// Per operator 2026-05-28T20:56Z "tests and integration and unit tests".

import { createHash } from 'node:crypto';
import { glyphAt } from './behcs.mjs';

export function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
export function pipeRow(...p) { return p.join('|'); }

// =================== 1. GLYPH MINT ===================
export function glyphMint(finding) {
  const pid = sha16(`glyph|${finding.class}|${finding.source}|${finding.name}`);
  const actor256 = parseInt(pid.slice(0, 4), 16) % 256;
  const actor1024 = parseInt(pid.slice(0, 4), 16) % 1024;
  return {
    pid,
    BEHCS256: glyphAt(actor256, 256),
    BEHCS1024: glyphAt(actor1024, 1024),
    actor256, actor1024,
    row: pipeRow('GLYPH', `class=${finding.class}`, `name=${finding.name}`, `pid=${pid}`, `BEHCS256=${glyphAt(actor256, 256)}`, `BEHCS1024=${glyphAt(actor1024, 1024)}`, `actor256=${actor256}`, `actor1024=${actor1024}`),
  };
}

// =================== 2. WHITE ROOM ===================
export const WHITE_ROOM_GATES = ['GC', 'super-gulp', 'reverse-gain-GNN', 'omnishannon', 'omnihermes', 'omniGNN', 'crop-paper'];
export function whiteRoomMint(finding) {
  const pid = sha16(`white-room|${finding.class}|${finding.name}`);
  const ingressGlyph = glyphAt(parseInt(pid.slice(0, 4), 16) % 256, 256);
  return {
    pid, ingressGlyph,
    gates: WHITE_ROOM_GATES,
    row: pipeRow('WHITE-ROOM', `name=WR-${finding.name}`, `pid=${pid}`, `class=${finding.class}`, `source=${finding.source}`, `ingress_glyph=${ingressGlyph}`, `gates=${WHITE_ROOM_GATES.join('+')}`, 'clean_room_origin=true', 'contamination_isolation=full'),
  };
}

// =================== 3. SHANNON ENTROPY ===================
export function shannonEntropy(laneCounts) {
  const total = laneCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return { H: 0, maxH: Math.log2(laneCounts.length), efficiency: 0, probs: laneCounts.map(() => 0) };
  const probs = laneCounts.map(c => c / total);
  const H = -probs.reduce((H, p) => H + (p > 0 ? p * Math.log2(p) : 0), 0) + 0; // +0 normalizes negative zero
  const maxH = Math.log2(laneCounts.length);
  const efficiency = (maxH > 0 ? H / maxH : 0) + 0;
  return { H, maxH, efficiency, probs };
}

// =================== 4. NON-DESTRUCTIVE GC ===================
export function gcSweepClassifier(filename) {
  return /\.(hbp|hbi|hex|sha256|ing)$/.test(filename);
}
export function gcManifestRow({ totalFiles, totalBytes, pathsScanned }) {
  return pipeRow('GC-INVENTORY', `paths_scanned=${pathsScanned}`, `total_files=${totalFiles}`, `total_bytes=${totalBytes}`, `total_MB=${(totalBytes / 1048576).toFixed(2)}`, `class=hbp_quintet_only`, 'action=INVENTORY_ONLY', 'deletions=0', 'policy=NEVER_DELETE_per_feedback_never_clean_live_disk');
}

// =================== 5. AUTO-TRANSLATE PIPES ===================
export const SUPPORTED_LANGS = ['BEHCS-256', 'BEHCS-1024', 'sha16-hash', 'glyph_5-apex'];
export function autoTranslate(pid, fromLang, toLang) {
  if (!SUPPORTED_LANGS.includes(fromLang)) throw new RangeError(`unknown fromLang: ${fromLang}`);
  if (!SUPPORTED_LANGS.includes(toLang)) throw new RangeError(`unknown toLang: ${toLang}`);
  const actor256 = parseInt(pid.slice(0, 4), 16) % 256;
  const actor1024 = parseInt(pid.slice(0, 4), 16) % 1024;
  const g256 = glyphAt(actor256, 256);
  const g1024 = glyphAt(actor1024, 1024);
  // Subset embedding: BEHCS-1024 to BEHCS-256 fails if actor >= 256
  if (fromLang === 'BEHCS-1024' && toLang === 'BEHCS-256' && actor1024 >= 256) {
    throw new RangeError(`cannot downcast BEHCS-1024 actor ${actor1024} to BEHCS-256`);
  }
  switch (toLang) {
    case 'BEHCS-256': return g256;
    case 'BEHCS-1024': return g1024;
    case 'sha16-hash': return pid;
    case 'glyph_5-apex': return `★${g256.slice(2)}`;
  }
}

// =================== 6. 3D MAP POINT ===================
export function to3DMapPoint(name) {
  const pid = sha16(`map|${name}`);
  const buf = Buffer.from(pid, 'hex');
  return {
    pid,
    x: buf.readUInt16BE(0) % 1024,
    y: buf.readUInt16BE(2) % 1024,
    z: buf.readUInt16BE(4) % 1024,
  };
}

// =================== 7. ATLAS V57 VOXEL ===================
export const ATLAS_V57_LAYERS = ['L24_glyph_minted', 'L25_white_rooms', 'L26_shannon', 'L27_auto_translate'];
export function atlasV57Voxel(finding, idx) {
  return {
    voxelId: `V57-newtech-${String(idx).padStart(3, '0')}`,
    name: finding.name,
    class: finding.class,
    source: finding.source,
    hilbert: finding.hilbert || 'derived-via-glyph-pid',
    status: 'DESIGN_MINTED_PENDING_APEX_MINT_via_existing_quintuple_seq_3471',
    row: pipeRow('VOXEL', `id=V57-newtech-${String(idx).padStart(3, '0')}`, `name=${finding.name}`, `class=${finding.class}`, `source=${finding.source}`, `hilbert=${finding.hilbert || 'derived-via-glyph-pid'}`),
  };
}

// =================== INTEGRATION: FULL PIPELINE ===================
export function runFullPipeline(findings, laneCounts = null) {
  const glyphs = findings.map(f => glyphMint(f));
  const whiteRooms = findings.map(f => whiteRoomMint(f));
  const shannon = laneCounts ? shannonEntropy(laneCounts) : null;
  const map3D = findings.map(f => ({ name: f.name, ...to3DMapPoint(f.name) }));
  const atlas = findings.map((f, i) => atlasV57Voxel(f, i));
  const translateExamples = glyphs.slice(0, 3).map(g => {
    const langs = SUPPORTED_LANGS;
    const out = {};
    for (const fromL of langs) {
      for (const toL of langs) {
        try { out[`${fromL}_to_${toL}`] = autoTranslate(g.pid, fromL, toL); }
        catch (e) { out[`${fromL}_to_${toL}`] = `ERR:${e.message}`; }
      }
    }
    return { pid: g.pid, translations: out };
  });
  return { glyphs, whiteRooms, shannon, map3D, atlas, translateExamples };
}

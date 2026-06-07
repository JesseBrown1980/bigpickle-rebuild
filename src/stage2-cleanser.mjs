// stage2-cleanser.mjs — the EXPLICIT stage-2 project-name cleanser + collector.
//
// The one seam the architecture map found missing: stage-1 rooms fire shelless
// agents in THROWAWAY rotated project folders (the free-trick — opencode tracks
// projects by name, so each spawn uses a fresh disposable name). The WORK is real;
// the folder name is a transient routing artifact. This tool makes the previously-
// IMPLICIT reconciliation EXPLICIT:
//
//   take a stage-1 record (PID + timestamp + throwaway project + answer + flags)
//     -> CLEANSE: drop the throwaway name, derive the canonical project from the PID
//     -> REFORMAT: emit a clean canonical HBP row (no JSON)
//     -> RE-POINT: route into the correctly-pointed stage-2 collection room
//        (deterministic by canonical project, so a project's work collects together)
//     -> tamper-evident: rolling prev_hash chain across cleansed rows
//   flags (verdict / gnn_lane / gc / mark / score) pass through for downstream routing.
//
// PID-specific throughout (Brown-Hilbert). The cleanse class is the LYMPHATIC lane
// (pid-chain-revolver.mjs:16 — "GULP + drain pipeline ... drain/cleanse class").
// Bidirectional: pumpToRoom() injects system data INTO any room (operator "or vice-versa").
//
// Reuses (no rebuild): district-fabric (roomDir/roomPid/roomCoords/sha), hbp-reader
// (parsePipeRow), pid-chain-revolver (PIDChainRevolver). HBP only — no JSON hot path.
// Operator: Jesse Daniel Brown — "Build it" 2026-06-01.

import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256hex, sha16, sha8, roomPid, roomCoords, roomDir, DISTRICTS, ROOM_SCALE } from './district-fabric.mjs';
import { parsePipeRow } from './hbp-reader.mjs';
import { PIDChainRevolver } from './pid-chain-revolver.mjs';

const ROOT_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const STAGE2_DISTRICT = 'prism'; // the dispatch-collect bank (district-fabric.mjs:87)
const CANON_PREFIX = 'asolaria/'; // a clean canonical project pointer starts here

function nowTs() { return new Date().toISOString(); }

function stage2RoomCount(scale) {
  const d = DISTRICTS.find((x) => x.name === STAGE2_DISTRICT);
  return (d ? d.rooms : 2000) * (scale ?? ROOM_SCALE);
}

// ── canonical project: the "correctly-pointed" stable identity, from the PID ──
// Same work -> same canonical project, no matter which throwaway folder it ran in.
export function canonicalProject(record = {}) {
  const district = record.district;
  const room = record.room ?? record.roomId ?? record.room_id;
  if (district != null && room != null && room !== '') {
    const c = roomCoords(roomPid(district, Number(room)));
    return `${CANON_PREFIX}${district}/${c.glyph}/r${String(room).padStart(6, '0')}`;
  }
  // fallback: derive deterministically from the agent PID's Brown-Hilbert coords
  const c = roomCoords(record.agent_pid || record.pid || '');
  return `${CANON_PREFIX}derived/${c.glyph}`;
}

// A project pointer is "clean/canonical" iff it points at the canonical namespace.
// Everything else (fire-xxxx, omni-room-behcs-256-xxxx, random hex dirs) is throwaway.
export function isThrowaway(projectName) {
  const p = String(projectName || '').replace(/\\/g, '/');
  return !p.startsWith(CANON_PREFIX);
}

// ── stage-2 collection room: deterministic by canonical project (group together) ──
export function collectionRoomFor(canonical, scale) {
  const count = stage2RoomCount(scale);
  const n = parseInt(sha16(canonical).slice(0, 8), 16) % count;
  return { roomId: n, count };
}

// canonical material for the tamper-evident row hash (build + verify must match)
function materialOf(f) {
  return [
    `pid=${f.pid}`, `cleanse_pid=${f.cleanse_pid}`, `canonical_project=${f.canonical_project}`,
    `was_project=${f.was_project}`, `cleansed=${f.cleansed}`, `district=${f.district}`,
    `room=${f.room}`, `collection_room=${f.collection_room}`, `mark=${f.mark}`,
    `score=${f.score}`, `verdict=${f.verdict}`, `gnn_lane=${f.gnn_lane}`, `gc=${f.gc}`,
    `answer_sha256=${f.answer_sha256}`, `answer_chars=${f.answer_chars}`,
    `stage1_ts=${f.stage1_ts}`, `ts=${f.ts}`, `prev_hash=${f.prev_hash}`,
  ].join('|');
}

// ── cleanse ONE record -> clean canonical HBP row (no routing, pure transform) ──
export function cleanseRecord(record = {}, opts = {}) {
  const was = String(record.project ?? record.throwaway_project ?? record.dir ?? '').replace(/\\/g, '/');
  const canonical = canonicalProject(record);
  const cleansed = isThrowaway(was) || was === '';
  const { roomId: collectionRoom } = collectionRoomFor(canonical, opts.scale);
  // preserve the work + its routing flags
  const answer = record.answer ?? '';
  const answer_sha256 = record.answer_sha256 || sha256hex(answer);
  const cleanse_pid = opts.cleansePid || `BH.STAGE2.CLEANSE.${sha8(canonical + (record.pid || '')).toUpperCase()}`;

  const f = {
    pid: record.pid || record.agent_pid || 'unknown',
    cleanse_pid,
    canonical_project: canonical,
    was_project: was || 'none',
    cleansed,
    district: record.district ?? 'derived',
    room: record.room ?? record.roomId ?? '',
    collection_room: collectionRoom,
    mark: record.mark ?? 'observe',
    score: record.score ?? '',
    verdict: record.verdict ?? '',
    gnn_lane: record.gnn_lane ?? 'reverse_gain_gnn',
    gc: record.gc ?? record.gc_disposition ?? 'keep_watch_compact',
    answer_sha256,
    answer_chars: answer.length,
    stage1_ts: record.ts ?? record.stage1_ts ?? '',
    ts: opts.ts || nowTs(),
    prev_hash: opts.prevHash || ROOT_HASH,
  };
  const row_hash = sha256hex(materialOf(f));
  const row = ['HBPv1', 'row=stage2_cleansed',
    ...Object.entries(f).map(([k, v]) => `${k}=${v}`),
    'json=0', `row_hash=${row_hash}`,
  ].join('|');
  return { fields: { ...f, row_hash }, row, row_hash, canonical_project: canonical, collection_room: collectionRoom, cleansed };
}

// ── re-point: write a cleansed row into its canonical stage-2 collection room ──
export function routeCleansed(cleansed, opts = {}) {
  if (opts.dryRun) return { routed: false, dryRun: true, room: cleansed.collection_room };
  const rd = roomDir(STAGE2_DISTRICT, cleansed.collection_room);
  mkdirSync(rd, { recursive: true });           // lazy inbox creation (matches fabric)
  const inbox = join(rd, 'inbox.hbp');
  appendFileSync(inbox, cleansed.row + '\n', 'utf8');
  return { routed: true, room: cleansed.collection_room, inbox };
}

// ── cleanse a STREAM of records with a rolling prev_hash chain (tamper-evident) ──
export function cleanseStream(records, opts = {}) {
  const rev = new PIDChainRevolver({ anchor: opts.anchor || 'ASOLARIA-STAGE2-CLEANSER' });
  const out = [];
  let prev = opts.prevHash || ROOT_HASH;
  for (let i = 0; i < records.length; i++) {
    const c = cleanseRecord(records[i], {
      ...opts, prevHash: prev, cleansePid: rev.next(),
      ts: opts.ts ? `${opts.ts}#${i}` : undefined,
    });
    if (opts.route) c.route = routeCleansed(c, opts);
    out.push(c);
    prev = c.row_hash;
  }
  return { rows: out, head: prev, count: out.length };
}

// ── verify a cleanse chain: re-hash + prev linkage + canonical re-derivation ──
export function verifyCleanseChain(rows) {
  const out = { ok: true, length: rows.length, breaks: [], cleansed_count: 0 };
  let prev = ROOT_HASH;
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i].fields ? rows[i].fields : parsePipeRow(rows[i].row || rows[i]).fields;
    const recomputed = sha256hex(materialOf(f));
    if (recomputed !== f.row_hash) { out.ok = false; out.breaks.push({ i, why: 'row_hash mismatch (tampered)' }); }
    if (f.prev_hash !== prev) { out.ok = false; out.breaks.push({ i, why: `prev_hash break: ${String(f.prev_hash).slice(0, 12)} != ${prev.slice(0, 12)}` }); }
    if (String(f.cleansed) === 'true') out.cleansed_count++;
    prev = f.row_hash;
  }
  return out;
}

// ── the SWEEP: scan stage-1 work-room outboxes, cleanse, collect into stage-2 ──
// Reads each room's outbox.hbp (stage-1 answers), cleanses every record, and
// re-points it into the canonical stage-2 collection room. Returns the chain.
export function cleanseWorkRooms(opts = {}) {
  const district = opts.district || 'engineering';
  const roomCount = opts.roomCount ?? 0;
  const records = [];
  // gather stage-1 records from work-room outboxes (or an explicit records list)
  if (opts.records) {
    records.push(...opts.records);
  } else {
    for (let i = 0; i < roomCount; i++) {
      const outbox = join(roomDir(district, i), 'outbox.hbp');
      if (!existsSync(outbox)) continue;
      for (const line of readFileSync(outbox, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const { fields } = parsePipeRow(line);
        records.push({ district, room: i, ...fields });
      }
    }
  }
  return cleanseStream(records, { ...opts, route: opts.route ?? true });
}

// ── bidirectional: pump arbitrary system data INTO any room ("or vice-versa") ──
export function pumpToRoom(district, roomId, payload, opts = {}) {
  const pid = opts.pid || `BH.PUMP.${district.toUpperCase()}.${sha8(String(payload)).toUpperCase()}`;
  const row = ['HBPv1', 'row=system_pump', `pid=${pid}`, `district=${district}`, `room=${roomId}`,
    `payload_sha256=${sha256hex(String(payload))}`, `payload_chars=${String(payload).length}`,
    `source=${opts.source || 'system'}`, `ts=${opts.ts || nowTs()}`, 'json=0',
    `row_hash=${sha8(pid + district + roomId + String(payload))}`].join('|');
  if (opts.dryRun) return { pumped: false, dryRun: true, pid, row };
  const rd = roomDir(district, roomId);
  mkdirSync(rd, { recursive: true });
  const inbox = join(rd, 'inbox.hbp');
  appendFileSync(inbox, row + '\n', 'utf8');
  return { pumped: true, pid, inbox, row };
}

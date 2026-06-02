// district-fabric.mjs — Asolaria district memory substrate on D: (the RAM-like layer).
// Creates typed room districts, each PID-addressed (Brown-Hilbert), each with a
// supervisor that knows the HBP/quant formats. HBP only — no JSON in the hot path.
//
// A district = a folder of rooms. A room = { ROOM.hbp descriptor, inbox.hbp, outbox.hbp }.
// Rooms are RAM-like staging: free opencode agents land, read inbox, write outbox, leave.
//
// Pairs with: hbp-emitter.mjs (write), hbp-reader.mjs (read/verify), room-dispatcher.mjs (execute)
// Operator: Jesse Daniel Brown — authorized 2026-06-01. Substrate: D: (729GB free).

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SUBSTRATE_ROOT = process.env.ASOLARIA_DISTRICT_ROOT || 'D:/Asolaria-Districts';
// Room scale: ASOLARIA_ROOM_SCALE=10 => 100k micro-kernels (operator 2026-06-01).
export const ROOM_SCALE = Number(process.env.ASOLARIA_ROOM_SCALE || 1);
// 2TB USB sector — pending substrate, auto-activates when the USB mounts on acer.
// SOVLINUX (2TB) currently lives on liris; F: empty on acer. Extended via omnifile
// hbi/usb read-write tools when present. NEVER format — create folders only.
export const USB_SECTOR = Object.freeze({
  drive_letter: process.env.ASOLARIA_USB_SECTOR || 'F:',
  reserve_gb: 1024, status: 'pending-mount',
  policy: 'create-folders-only-never-format', mechanism: 'omnifile-hbi-usb-read-write-to-sovlinux',
});

// ── crypto / PID helpers (no JSON) ───────────────────────────────────────────
export function sha256hex(s) { return createHash('sha256').update(String(s)).digest('hex'); }
export function sha16(s) { return sha256hex(s).slice(0, 16); }
export function sha8(s) { return sha16(s).slice(0, 8); }
function ts() { return new Date().toISOString(); }

// ── 60D+ coordinate + language + tuple, all derived deterministically from PID ─
// sha256(pid) = 64 hex chars => up to 64 dimensions (60D+ friendly), compact.
// BEHCS-1024 glyph (the language) from cp. Cube tuple (6 axes) from coord bytes.
const TUPLE_AXES = Object.freeze({
  wave: ['scout', 'evidence', 'executor', 'fabric', 'voice', 'planner'],
  protocol: ['bus', 'usb', 'adb', 'direct-wire', 'tailnet', 'fabric'],
  surface: ['dashboard', 'canon', 'viz', 'agent', 'device', 'operator'],
  dimension: ['G', 'I', 'O', 'B', 'S', 'C'],
  body: ['operator', 'organ', 'citizen', 'free-agent', 'supervisor', 'prof'],
});
export function roomCoords(pid) {
  const h = sha256hex(pid);                       // 64 hex = 64 dims
  const byte = (i) => parseInt(h.slice(i * 2, i * 2 + 2), 16); // dim value 0..255
  const cp = parseInt(h.slice(0, 3), 16) % 1024;  // BEHCS-1024 codepoint
  const glyph = 'cp' + cp.toString(16).padStart(4, '0'); // language token (behcs.mjs cp-notation)
  // cube tuple (the deep-wave 6 axes), each from its own coord byte
  const tuple = [
    `wave=${TUPLE_AXES.wave[byte(0) % 6]}`,
    `protocol=${TUPLE_AXES.protocol[byte(1) % 6]}`,
    `surface=${TUPLE_AXES.surface[byte(2) % 6]}`,
    `dim=${TUPLE_AXES.dimension[byte(3) % 6]}`,
    `body=${TUPLE_AXES.body[byte(4) % 6]}`,
    `shannon=${byte(5) % 12}`,
  ].join(':');
  return { coord64: h, dims: 64, cp, glyph, tuple };
}

// Brown-Hilbert d2xy — deterministic (x,y) for a 1D index. bits sized to district capacity.
export function hilbertXY(n, d) {
  let rx, ry, t = d, x = 0, y = 0;
  for (let s = 1; s < n; s *= 2) {
    rx = 1 & (t / 2);
    ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const tmp = x; x = y; y = tmp;
    }
    x += s * rx; y += s * ry;
    t = Math.floor(t / 4);
  }
  return { x, y };
}

// Room PID: Brown-Hilbert addressed, deterministic, ~constant time.
export function roomPid(district, idx, gridN = 128) {
  const { x, y } = hilbertXY(gridN, idx);
  const h = sha16(`room|${district}|${idx}|hilbert|${x}|${y}`);
  return `BH.DISTRICT.${district.toUpperCase()}.R${String(idx).padStart(5, '0')}.${h.toUpperCase()}`;
}

// ── district catalog ─────────────────────────────────────────────────────────
// Each: name, kind, role, default room count, cp band (locator coordinate).
export const DISTRICTS = Object.freeze([
  { name: 'rotator',     kind: 'pid-rotation',   role: 'revolver feed — rotate PIDs through rooms one-after-another', rooms: 2000, cp: 480 },
  { name: 'prism',       kind: 'dispatch-collect', role: 'forward-prism dispatch + reverse-prism collect',            rooms: 2000, cp: 576 },
  { name: 'engineering', kind: 'build',          role: 'code/build/engineering rooms for real work',                 rooms: 2000, cp: 704 },
  { name: 'white-room',  kind: 'clean-mint',     role: 'clean-room mint — genius/mistake extraction from 0',          rooms: 1500, cp: 800 },
  { name: 'gnn-feed',    kind: 'gnn-edge',       role: 'GNN edge rooms — forward + reverse-gain scoring',             rooms: 1500, cp: 384 },
  { name: 'council',     kind: 'vote-review',    role: 'vote-quorum + review rooms — supervisor decisions',           rooms: 1000, cp: 256 },
]);

// ── HBP writers (no JSON) ────────────────────────────────────────────────────
function writeRoomDescriptor(roomDir, district, idx, pid, bandCp) {
  const { x, y } = hilbertXY(256, idx % 65536);
  const c = roomCoords(pid); // 60D+ coord + glyph (language) + cube tuple
  const row = [
    'HBPv1',
    'row=room_descriptor',
    `pid=${pid}`,
    `district=${district}`,
    `idx=${idx}`,
    `kind=micro-kernel`,
    `bh3d=${x},${y}`,
    `band_cp=${bandCp}`,
    `cp=${c.cp}`,
    `glyph=${c.glyph}`,           // BEHCS-1024 language token
    `dims=${c.dims}`,
    `coord64=${c.coord64}`,        // 60D+ friendly coordinate (64 dims)
    `tuple=${c.tuple}`,            // cube tuple (the 6 deep-wave axes)
    `state=empty`,
    `inbox=inbox.hbp`, `outbox=outbox.hbp`,
    `created=${ts()}`,
    'json=0', 'runtime=0',
    `row_hash=${sha8(pid + district + idx)}`,
  ].join('|');
  writeFileSync(join(roomDir, 'ROOM.hbp'), row + '\n', 'utf8');
}

function writeDistrictSupervisor(districtDir, d, roomCount, anchorPid) {
  // PID-specific supervisor that KNOWS the new formats. HBP heartbeat-locator row.
  const supPid = `BH.SUPERVISOR.DISTRICT.${d.name.toUpperCase()}.${sha16('sup|' + d.name).toUpperCase()}`;
  const row = [
    'HBPv1',
    'layer=district-supervisor',
    `entity=district_${d.name}_supervisor`,
    `supervisor_pid=${supPid}`,
    `anchor_pid=${anchorPid}`,
    `kind=${d.kind}`,
    `band=cp-${d.cp}`,
    `role=${d.role}`,
    `room_count=${roomCount}`,
    'knows_formats=hbp+hbi+sha256+hex+quad-quant',
    'pid_specific=true',
    'reader=hbp-reader.mjs', 'writer=hbp-emitter.mjs',
    `created=${ts()}`,
    'json=0', 'runtime=0',
    `row_hash=${sha8(supPid + d.name + roomCount)}`,
  ].join('|');
  writeFileSync(join(districtDir, '_SUPERVISOR.hbp'), row + '\n', 'utf8');
  return supPid;
}

// ── create one district ──────────────────────────────────────────────────────
export function createDistrict(d, opts = {}) {
  const roomCount = (opts.rooms || d.rooms) * (opts.scale ?? ROOM_SCALE);
  const anchorPid = opts.anchorPid || 'ASOLARIA-DISTRICT-FABRIC-PID-2026-06-01';
  const districtDir = join(SUBSTRATE_ROOT, d.name);
  const roomsDir = join(districtDir, 'rooms');
  mkdirSync(roomsDir, { recursive: true });

  const supPid = writeDistrictSupervisor(districtDir, d, roomCount, anchorPid);

  let created = 0;
  let lastShard = null;
  for (let i = 0; i < roomCount; i++) {
    // shard every 500 rooms to keep dir sizes sane at 100k scale
    const shard = `shard-${String(Math.floor(i / 500)).padStart(4, '0')}`;
    const rdir = join(roomsDir, shard, `room-${String(i).padStart(6, '0')}`);
    if (opts.dryRun) { created++; continue; }
    mkdirSync(rdir, { recursive: true });
    const pid = roomPid(d.name, i);
    writeRoomDescriptor(rdir, d.name, i, pid, d.cp);
    // inbox/outbox are LAZY — created on first use by the dispatcher (100k folders, not 300k files)
    created++;
    lastShard = shard;
  }
  return { district: d.name, supervisor_pid: supPid, rooms: created, dir: districtDir, cp: d.cp, shards: lastShard };
}

// ── create all districts ─────────────────────────────────────────────────────
export function createAllDistricts(opts = {}) {
  mkdirSync(SUBSTRATE_ROOT, { recursive: true });
  const results = [];
  for (const d of DISTRICTS) results.push(createDistrict(d, opts));
  // fabric manifest (HBP, not JSON)
  const totalRooms = results.reduce((a, r) => a + r.rooms, 0);
  const manifestRows = [
    `HBPv1|row=fabric_manifest|substrate=${SUBSTRATE_ROOT}|districts=${results.length}|total_rooms=${totalRooms}|room_scale=${opts.scale ?? ROOM_SCALE}|dims=64|language=BEHCS-1024|tuple_axes=wave:protocol:surface:dim:body:shannon|created=${ts()}|json=0|row_hash=${sha8(SUBSTRATE_ROOT + totalRooms)}`,
    ...results.map((r) => `HBPv1|row=district|name=${r.district}|supervisor_pid=${r.supervisor_pid}|rooms=${r.rooms}|cp=${r.cp}|dir=${r.dir}`),
    `HBPv1|row=usb_sector_pending|drive=${USB_SECTOR.drive_letter}|reserve_gb=${USB_SECTOR.reserve_gb}|status=${USB_SECTOR.status}|policy=${USB_SECTOR.policy}|mechanism=${USB_SECTOR.mechanism}|note=auto-activates-when-2TB-mounts-on-acer`,
  ];
  if (!opts.dryRun) writeFileSync(join(SUBSTRATE_ROOT, 'FABRIC.hbp'), manifestRows.join('\n') + '\n', 'utf8');
  return { substrate: SUBSTRATE_ROOT, districts: results, total_rooms: totalRooms };
}

// ── room path resolver (for the dispatcher) ──────────────────────────────────
export function roomDir(district, idx) {
  const shard = `shard-${String(Math.floor(idx / 500)).padStart(4, '0')}`;
  return join(SUBSTRATE_ROOT, district, 'rooms', shard, `room-${String(idx).padStart(6, '0')}`);
}

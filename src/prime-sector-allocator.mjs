// prime-sector-allocator.mjs — the PRIME SECTOR structure of the fabric.
//
// Operator vision (2026-06-01): "1 million room Workspace in 1 sector. Each sector
// gets 1 million workers. there are Prime Sectors and expandable mapping like brown
// hilbert cube." This is the runtime that turns the substrate into sectors:
//   - a SECTOR = a 1,000,000-room workspace = 1,000,000 workers
//   - each sector carries a canonical PRIME identity (primeAt) — the "Prime Sector"
//   - rooms are Brown-Hilbert addressed; the cube is EXPANDABLE (N sectors = N million)
//   - the unique global address is the sha-PID; the (x,y) is the cube projection
//
// Grounded in the apex-minted sectors-law (seq 3471): 5 Sector Chiefs (hilbert 870-874),
// the GAC 6-level hierarchy, the PID-registration-office. Build on truth, not mythology.
// HBP-first. Operator: Jesse Daniel Brown — "let's get building" 2026-06-01.

import { primeAt } from './primes.mjs';
import { roomCoords, hilbertXY, sha16 } from './district-fabric.mjs';

export const SECTOR_CAPACITY = 1_000_000;   // 1M rooms = 1M workers per sector

// the 5 grounded Sector Chiefs (sectors-law master, hilbert 870-874)
export const SECTOR_CHIEFS = Object.freeze([
  { name: 'CHIEF-ROBIN-BIOLOGY-SECTOR', hilbert: 870 },
  { name: 'CHIEF-CO-SCIENTIST-HYPOTHESIS-SECTOR', hilbert: 871 },
  { name: 'CHIEF-SIMULA-SYNTHETIC-DATA-SECTOR', hilbert: 872 },
  { name: 'CHIEF-SAKANA-PAPER-PIPELINE-SECTOR', hilbert: 873 },
  { name: 'CHIEF-BOIKO-CHEMISTRY-LAB-SECTOR', hilbert: 874 },
]);

// PRIME SECTOR: sector index -> its canonical prime + 1M-room range + chief + cube coord.
export function sectorFor(sectorIndex) {
  if (!Number.isInteger(sectorIndex) || sectorIndex < 0) throw new RangeError('sectorIndex must be a non-negative integer');
  const prime = primeAt(sectorIndex);                // the sector's canonical PRIME identity
  const base = sectorIndex * SECTOR_CAPACITY;         // global room base (1M stride)
  const sectorId = `BH.SECTOR.P${prime}.IDX${sectorIndex}.${sha16('sector|' + sectorIndex + '|' + prime).slice(0, 8).toUpperCase()}`;
  const c = roomCoords(sectorId);
  const chief = SECTOR_CHIEFS[sectorIndex % SECTOR_CHIEFS.length];
  return {
    sectorIndex, prime, sectorId, capacity: SECTOR_CAPACITY,
    roomRangeStart: base, roomRangeEnd: base + SECTOR_CAPACITY - 1,
    cp: c.cp, glyph: c.glyph, coord64: c.coord64, tuple: c.tuple,
    chief: chief.name, chief_hilbert: chief.hilbert,
  };
}

// global Brown-Hilbert room address: (sectorIndex, roomInSector) -> unique global addr.
// The sha-PID is the UNIQUE address; (x,y) is the expandable-cube projection.
export function globalRoomAddress(sectorIndex, roomInSector) {
  if (roomInSector < 0 || roomInSector >= SECTOR_CAPACITY) {
    throw new RangeError(`roomInSector out of 1M sector capacity (0..${SECTOR_CAPACITY - 1})`);
  }
  const prime = primeAt(sectorIndex);
  const globalIndex = sectorIndex * SECTOR_CAPACITY + roomInSector;
  const pid = `BH.SECTOR.P${prime}.R${String(roomInSector).padStart(7, '0')}.${sha16('room|' + globalIndex).slice(0, 8).toUpperCase()}`;
  // expandable cube projection over a bounded 16-bit Hilbert grid (the PID carries full uniqueness)
  const { x, y } = hilbertXY(65536, globalIndex % (65536 * 65536));
  return { sectorIndex, roomInSector, globalIndex, prime, pid, bh3d: { x, y }, expandable: true };
}

// fabric capacity across N prime sectors (expandable — the whole point)
export function fabricCapacity(nSectors) {
  return { sectors: nSectors, rooms: nSectors * SECTOR_CAPACITY, workers: nSectors * SECTOR_CAPACITY };
}

// HBP descriptor for a sector (no JSON)
export function sectorRow(sectorIndex) {
  const s = sectorFor(sectorIndex);
  return ['HBPv1', 'row=prime_sector', `idx=${s.sectorIndex}`, `prime=${s.prime}`, `sectorId=${s.sectorId}`,
    `capacity=${s.capacity}`, `rooms=${s.roomRangeStart}..${s.roomRangeEnd}`, `cp=${s.cp}`, `glyph=${s.glyph}`,
    `tuple=${s.tuple}`, `chief=${s.chief}`, `chief_hilbert=${s.chief_hilbert}`, 'expandable=true', 'json=0'].join('|');
}

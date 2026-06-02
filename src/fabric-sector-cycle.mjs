// fabric-sector-cycle.mjs — the converged acer legs operating as ONE fabric cycle.
//
// Composes the byte-proven pieces into a single sector-aware turn:
//   LEG-2 prime-sector-allocator  -> globalRoomAddress (each room's address)
//   score                         -> genius / mistake verdict
//   LEG-3 github-commit-emitter    -> genius marks EMIT to the middle-ground bus (commit=emit)
//
// This is the integration: a prime-sector's rooms get Brown-Hilbert addresses (the address
// space liris/acer/falcon byte-converged on), are scored, and genius marks persist to the
// GitHub bus. Never-drop held (genius+mistake=rooms). HBP only. The white-room ENGINE
// (liris's leg) plugs in as the `score` function when the domain scorer lands.
// Operator: Jesse Daniel Brown — "let's get building" 2026-06-01.

import { sectorFor, globalRoomAddress } from './prime-sector-allocator.mjs';
import { commitEnvelope } from './github-commit-emitter.mjs';
import { createHash } from 'node:crypto';

// the CANONICAL FEDERATED scorer — byte-converged with liris's geniusScore (the 3rd
// byte-proven convergence, verified 2026-06-01: acer==liris on
// BH.SECTOR.P2.R0000000.7593C541 = 0.755838). So acer-addresses + liris-scores +
// acer-buses produce IDENTICAL verdicts on all 3 vantages. HONEST: this is the
// PLACEHOLDER (address-derived, ignores work content); the real domain scorer (lever-2)
// scores the WORK and needs a real task — it won't be a pure pid-fn.
function defaultScore(pid) {
  return parseInt(createHash('sha256').update(String(pid)).digest('hex').slice(0, 8), 16) / 0xffffffff;
}

// run `rooms` rooms in prime-sector `sectorIndex`: address -> score -> classify -> (genius->bus).
export function runSectorCycle({ sectorIndex, rooms, score = defaultScore, geniusThreshold = 0.72, repoDir = null, prefix = 'sector' }) {
  const sector = sectorFor(sectorIndex);
  const out = {
    sectorIndex, prime: sector.prime, chief: sector.chief, capacity: sector.capacity,
    rooms, genius: 0, mistake: 0, emitted: 0, geniusEnvelopes: [],
  };
  for (let r = 0; r < rooms; r++) {
    const addr = globalRoomAddress(sectorIndex, r);   // the byte-converged sector address
    const s = score(addr.pid);
    if (s >= geniusThreshold) {
      out.genius++;
      const env = `HBPv1|row=sector_genius|pid=${addr.pid}|sector=${sectorIndex}|prime=${addr.prime}|room=${r}|score=${s.toFixed(4)}|json=0`;
      out.geniusEnvelopes.push(env);
      if (repoDir) { commitEnvelope(repoDir, { roomPid: addr.pid, seq: r, envelope: env }, { prefix }); out.emitted++; }
    } else {
      out.mistake++;   // mistakes are not dropped — counted; compaction is the store's job (never-delete)
    }
  }
  return out;
}

// HBP receipt for a sector cycle (no JSON)
export function cycleRow(result) {
  return ['HBPv1', 'row=sector_cycle', `sector=${result.sectorIndex}`, `prime=${result.prime}`,
    `chief=${result.chief}`, `rooms=${result.rooms}`, `genius=${result.genius}`, `mistake=${result.mistake}`,
    `emitted=${result.emitted}`, `never_dropped=${result.genius + result.mistake === result.rooms}`, 'json=0'].join('|');
}

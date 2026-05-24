// Multi-drive enumerator. The helm needs to reach files on any drive — C, D,
// USB, network mounts — without hardcoding letters.
//
// Spec: layer 7. Windows-only fast path uses `wmic logicaldisk`. POSIX fallback
// returns a single root entry so the same shape works on non-Windows hosts.

import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

function normalizeLetter(input) {
  if (input == null) return null;
  const m = String(input).trim().match(/^([A-Za-z])(?::[\\/]?)?$/);
  return m ? m[1].toUpperCase() : null;
}

function enumerateWindows() {
  try {
    const raw = execSync('wmic logicaldisk get DeviceID,FreeSpace,Size /format:csv', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).toString('utf8');
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const header = lines.shift();
    if (!header || !/DeviceID/i.test(header)) return [];
    const cols = header.split(',').map((c) => c.trim());
    const idxDev = cols.findIndex((c) => /DeviceID/i.test(c));
    const idxFree = cols.findIndex((c) => /FreeSpace/i.test(c));
    const idxSize = cols.findIndex((c) => /Size/i.test(c));
    const out = [];
    for (const line of lines) {
      const parts = line.split(',');
      const dev = parts[idxDev] || '';
      const letter = normalizeLetter(dev);
      if (!letter) continue;
      const freeBytes = Number(parts[idxFree] || '0');
      const totalBytes = Number(parts[idxSize] || '0');
      out.push({
        letter,
        mounted: totalBytes > 0,
        freeBytes,
        totalBytes,
        root: `${letter}:/`,
      });
    }
    return out;
  } catch {
    return enumerateByProbing();
  }
}

function enumerateByProbing() {
  const out = [];
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    const root = `${letter}:/`;
    if (!existsSync(root)) continue;
    let totalBytes = 0;
    let freeBytes = 0;
    try {
      const st = statSync(root);
      if (st && st.isDirectory()) {
        totalBytes = 1;
        freeBytes = 1;
      }
    } catch {
      // unmounted but enumerated
    }
    out.push({ letter, mounted: totalBytes > 0, freeBytes, totalBytes, root });
  }
  return out;
}

export function enumerateDrives() {
  if (process.platform === 'win32') return enumerateWindows();
  return [{ letter: '/', mounted: true, freeBytes: 0, totalBytes: 0, root: '/' }];
}

export function driveExists(letterOrPath) {
  const letter = normalizeLetter(letterOrPath);
  if (!letter) return false;
  return enumerateDrives().some((d) => d.letter === letter && d.mounted);
}

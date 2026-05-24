// Pins: the helm enumerates mounted drives without hardcoding letters.
// Spec: TESTS-PLAN.md Layer 7 — multi-drive reach is canonical for the helm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumerateDrives, driveExists } from '../src/drive-enumerator.mjs';

test('enumerateDrives returns at least one drive on Windows', () => {
  const drives = enumerateDrives();
  assert.ok(Array.isArray(drives), 'must return array');
  assert.ok(drives.length >= 1, 'must find at least one drive');
});

test('every enumerated drive has letter + mounted + free/total bytes', () => {
  const drives = enumerateDrives();
  for (const d of drives) {
    assert.match(d.letter, /^[A-Z]$/, `letter must be single uppercase: ${d.letter}`);
    assert.equal(typeof d.mounted, 'boolean');
    if (d.mounted) {
      assert.equal(typeof d.freeBytes, 'number');
      assert.equal(typeof d.totalBytes, 'number');
      assert.ok(d.totalBytes >= d.freeBytes);
    }
  }
});

test('C and D drives appear and are mounted on this host', () => {
  const drives = enumerateDrives();
  const letters = drives.filter((d) => d.mounted).map((d) => d.letter);
  assert.ok(letters.includes('C'), `C drive missing: ${letters.join(',')}`);
  assert.ok(letters.includes('D'), `D drive missing: ${letters.join(',')}`);
});

test('driveExists handles letter forms case-insensitively', () => {
  assert.equal(driveExists('C'), true);
  assert.equal(driveExists('c'), true);
  assert.equal(driveExists('C:'), true);
  assert.equal(driveExists('C:/'), true);
  assert.equal(driveExists('ZZ'), false);
});

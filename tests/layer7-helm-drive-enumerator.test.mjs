// Pins: the helm enumerates mounted drives without hardcoding letters.
// Spec: TESTS-PLAN.md Layer 7 — multi-drive reach is canonical for the helm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enumerateDrives, driveExists } from '../src/drive-enumerator.mjs';

const isWin = process.platform === 'win32';

test('enumerateDrives returns at least one drive on any platform', () => {
  const drives = enumerateDrives();
  assert.ok(Array.isArray(drives), 'must return array');
  assert.ok(drives.length >= 1, 'must find at least one drive');
});

test('every Windows-enumerated drive has letter + mounted + free/total bytes', { skip: !isWin }, () => {
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

test('C and D drives appear and are mounted on the acer build host', { skip: !isWin }, () => {
  const drives = enumerateDrives();
  const letters = drives.filter((d) => d.mounted).map((d) => d.letter);
  assert.ok(letters.includes('C'), `C drive missing: ${letters.join(',')}`);
  assert.ok(letters.includes('D'), `D drive missing: ${letters.join(',')}`);
});

test('driveExists handles letter forms case-insensitively (Windows)', { skip: !isWin }, () => {
  assert.equal(driveExists('C'), true);
  assert.equal(driveExists('c'), true);
  assert.equal(driveExists('C:'), true);
  assert.equal(driveExists('C:/'), true);
  assert.equal(driveExists('ZZ'), false);
});

test('driveExists returns false for clearly invalid input on any platform', () => {
  assert.equal(driveExists(''), false);
  assert.equal(driveExists(null), false);
  assert.equal(driveExists('ZZZ'), false);
});

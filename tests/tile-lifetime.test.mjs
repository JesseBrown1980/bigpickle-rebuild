// Tile-lifetime tests.
// Per Dan-hookwall-modernization-2026-05-15 fix #8.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { tileLifetime, TILE_LIFETIME_ACTIONS, STATUS } from '../src/tile-lifetime.mjs';

describe('tile-lifetime — STATUS surface', () => {
  test('exposes schema + actions + defaults + spec', () => {
    assert.equal(STATUS.schema, 'tile-lifetime.v1');
    assert.equal(STATUS.default_hot_window_ms, 5 * 60 * 1000);
    assert.equal(STATUS.default_warm_window_ms, 60 * 60 * 1000);
    assert.equal(STATUS.actions.KEEP_HOT, 'keep-hot');
    assert.equal(STATUS.actions.DEMOTE_WARM, 'demote-warm');
    assert.equal(STATUS.actions.EXPIRE, 'expire');
    assert.ok(STATUS.spec.includes('fix_8_gc_by_tile_lifetime'));
  });
});

describe('tile-lifetime — action classification by idle age', () => {
  test('fresh tile (just-accessed) → keep-hot', () => {
    const now = 1_000_000_000_000;
    const result = tileLifetime({ lastAccessTs: now - 1000, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.KEEP_HOT);
    assert.equal(result.ageMs, 1000);
  });

  test('5min-1h idle → demote-warm', () => {
    const now = 1_000_000_000_000;
    const tenMinAgo = now - 10 * 60 * 1000;
    const result = tileLifetime({ lastAccessTs: tenMinAgo, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.DEMOTE_WARM);
    assert.equal(result.ageMs, 10 * 60 * 1000);
  });

  test('>1h idle → expire', () => {
    const now = 1_000_000_000_000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const result = tileLifetime({ lastAccessTs: twoHoursAgo, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.EXPIRE);
    assert.equal(result.ageMs, 2 * 60 * 60 * 1000);
  });

  test('exactly at hot threshold → demote-warm (boundary)', () => {
    const now = 1_000_000_000_000;
    const exactlyHotWindow = now - 5 * 60 * 1000;
    const result = tileLifetime({ lastAccessTs: exactlyHotWindow, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.DEMOTE_WARM);
  });

  test('exactly at warm threshold → expire (boundary)', () => {
    const now = 1_000_000_000_000;
    const exactlyWarmWindow = now - 60 * 60 * 1000;
    const result = tileLifetime({ lastAccessTs: exactlyWarmWindow, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.EXPIRE);
  });

  test('negative age (clock skew) clamped to 0 → keep-hot', () => {
    const now = 1_000_000_000_000;
    const future = now + 5000;
    const result = tileLifetime({ lastAccessTs: future, currentTs: now });
    assert.equal(result.action, TILE_LIFETIME_ACTIONS.KEEP_HOT);
    assert.equal(result.ageMs, 0);
  });
});

describe('tile-lifetime — configurable windows', () => {
  test('custom 1s hot / 2s warm windows respected', () => {
    const now = 1_000_000_000_000;
    const cfg = { hotWindowMs: 1000, warmWindowMs: 2000 };
    assert.equal(tileLifetime({ lastAccessTs: now - 500, currentTs: now, opts: cfg }).action, TILE_LIFETIME_ACTIONS.KEEP_HOT);
    assert.equal(tileLifetime({ lastAccessTs: now - 1500, currentTs: now, opts: cfg }).action, TILE_LIFETIME_ACTIONS.DEMOTE_WARM);
    assert.equal(tileLifetime({ lastAccessTs: now - 3000, currentTs: now, opts: cfg }).action, TILE_LIFETIME_ACTIONS.EXPIRE);
  });
});

describe('tile-lifetime — validation', () => {
  test('missing lastAccessTs → TypeError', () => {
    assert.throws(() => tileLifetime({}), TypeError);
  });

  test('non-finite lastAccessTs → TypeError', () => {
    assert.throws(() => tileLifetime({ lastAccessTs: NaN }), TypeError);
    assert.throws(() => tileLifetime({ lastAccessTs: Infinity }), TypeError);
  });

  test('non-positive hotWindowMs → RangeError', () => {
    assert.throws(
      () => tileLifetime({ lastAccessTs: 0, opts: { hotWindowMs: 0, warmWindowMs: 100 } }),
      RangeError,
    );
    assert.throws(
      () => tileLifetime({ lastAccessTs: 0, opts: { hotWindowMs: -1, warmWindowMs: 100 } }),
      RangeError,
    );
  });

  test('hot >= warm → RangeError', () => {
    assert.throws(
      () => tileLifetime({ lastAccessTs: 0, opts: { hotWindowMs: 100, warmWindowMs: 100 } }),
      RangeError,
    );
    assert.throws(
      () => tileLifetime({ lastAccessTs: 0, opts: { hotWindowMs: 200, warmWindowMs: 100 } }),
      RangeError,
    );
  });
});

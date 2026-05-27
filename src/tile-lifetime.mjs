// Tile lifetime policy — age-based hot/warm/expire decision.
//
// Spec: Dan-hookwall-modernization-2026-05-15 fix #8 (gc_by_tile_lifetime):
// "Tiles expire/demote through GC retention policy instead of accumulating
// full hydrated state."
//
// Backed empirically by 1M run (2026-05-26T23:07Z):
// - breath_pacing_feedback lane (742 marks score=1.0): "lifetime policy
//   prevents unbounded growth"
// - attention_training_loop lane (730 marks): "session-to-session
//   confidence requires bounded tile retention"
//
// Pairs with gc-runtime.mjs (throughput-based gulp every N messages).
// gc-runtime answers "when do we sweep?", tile-lifetime answers "what is
// each tile's current action class?".
//
// Pure function. No side effects. No file I/O. Caller decides what to do
// with the returned action.

const DEFAULT_HOT_WINDOW_MS = 5 * 60 * 1000;    // 5 min active → keep-hot
const DEFAULT_WARM_WINDOW_MS = 60 * 60 * 1000;  // 1 hour idle → demote-warm
// Beyond warm → expire

export const TILE_LIFETIME_ACTIONS = Object.freeze({
  KEEP_HOT: 'keep-hot',
  DEMOTE_WARM: 'demote-warm',
  EXPIRE: 'expire',
});

const VALID_ACTIONS = new Set(Object.values(TILE_LIFETIME_ACTIONS));

// tileLifetime returns the action class for a tile based on its idle age.
//
// args:
//   lastAccessTs: ms since epoch when tile was last touched (required, finite number)
//   currentTs:    ms since epoch "now" (defaults to Date.now())
//   opts:         { hotWindowMs, warmWindowMs } overrides
//
// returns:
//   { action, ageMs, hotWindowMs, warmWindowMs }
//
// throws TypeError if lastAccessTs is missing/not-a-number.
// throws RangeError if windows are not positive integers, or hot >= warm.
export function tileLifetime({ lastAccessTs, currentTs, opts = {} } = {}) {
  if (typeof lastAccessTs !== 'number' || !Number.isFinite(lastAccessTs)) {
    throw new TypeError('tileLifetime: lastAccessTs must be a finite number (ms since epoch)');
  }
  const now = typeof currentTs === 'number' && Number.isFinite(currentTs) ? currentTs : Date.now();
  const hotWindowMs = opts.hotWindowMs ?? DEFAULT_HOT_WINDOW_MS;
  const warmWindowMs = opts.warmWindowMs ?? DEFAULT_WARM_WINDOW_MS;

  if (!Number.isInteger(hotWindowMs) || hotWindowMs <= 0) {
    throw new RangeError(`tileLifetime: hotWindowMs must be a positive integer; got ${hotWindowMs}`);
  }
  if (!Number.isInteger(warmWindowMs) || warmWindowMs <= 0) {
    throw new RangeError(`tileLifetime: warmWindowMs must be a positive integer; got ${warmWindowMs}`);
  }
  if (hotWindowMs >= warmWindowMs) {
    throw new RangeError(
      `tileLifetime: hotWindowMs (${hotWindowMs}) must be < warmWindowMs (${warmWindowMs})`
    );
  }

  const ageMs = Math.max(0, now - lastAccessTs);

  let action;
  if (ageMs < hotWindowMs) {
    action = TILE_LIFETIME_ACTIONS.KEEP_HOT;
  } else if (ageMs < warmWindowMs) {
    action = TILE_LIFETIME_ACTIONS.DEMOTE_WARM;
  } else {
    action = TILE_LIFETIME_ACTIONS.EXPIRE;
  }

  return { action, ageMs, hotWindowMs, warmWindowMs };
}

export const STATUS = Object.freeze({
  schema: 'tile-lifetime.v1',
  default_hot_window_ms: DEFAULT_HOT_WINDOW_MS,
  default_warm_window_ms: DEFAULT_WARM_WINDOW_MS,
  actions: TILE_LIFETIME_ACTIONS,
  spec: 'dan_hookwall_modernization_2026_05_15_fix_8_gc_by_tile_lifetime',
  pairs_with: 'src/gc-runtime.mjs (throughput-based)',
});

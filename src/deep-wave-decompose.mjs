// Deep-Wave beat decomposition + room id format.
// Canon: project_o_cohort_cross_inbox_watchdog_6wave_cascade_md 2026-04-30
// + acer :4949/api/cascade/plan + C:/AsolariaMetal/68_DEEP_WAVE_SECOND_CASCADE/
//
// 6 waves x 15,552 beats = 93,312 total.
// Per-wave decomposition: PROTOCOL(6) x SURFACE(6) x DIMENSION(6) x BODY(6) x SHANNON(12) = 15,552.
// D1 LAYER collapsed into wave per cascade-pattern canon (wave i = layer i).

export const TOTAL_BEATS = 93_312;
export const WAVE_COUNT = 6;
export const BEATS_PER_WAVE = 15_552;

export const WAVE_NAMES = ['scout', 'evidence', 'executor', 'fabric', 'voice', 'planner'];
export const WAVE_LAYER_LABELS = ['L0 layer-scan', 'L1 evidence-collect', 'L2-L3 exec+dispatch', 'L4 fabric-stitch', 'L5 promote', 'L6 closure'];
export const PROTOCOL_NAMES = ['bus', 'usb', 'adb', 'direct-wire', 'tailnet', 'fabric'];
export const SURFACE_NAMES = ['dashboard', 'canon', 'viz', 'agent', 'device', 'operator'];
export const DIMENSION_NAMES = ['G', 'I', 'O', 'B', 'S', 'C'];
export const BODY_NAMES = ['operator', 'organ', 'citizen', 'free-agent', 'supervisor', 'prof'];
export const SHANNON_POSITIONS = 12;

export function decomposeBeat(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAL_BEATS) {
    throw new RangeError(`decomposeBeat: i must be integer in [0, ${TOTAL_BEATS}) (got ${i})`);
  }
  const wave = Math.floor(i / BEATS_PER_WAVE);
  const inWave = i % BEATS_PER_WAVE;
  const protocol = Math.floor(inWave / 2592);
  const inProtocol = inWave % 2592;
  const surface = Math.floor(inProtocol / 432);
  const inSurface = inProtocol % 432;
  const dimension = Math.floor(inSurface / 72);
  const inDimension = inSurface % 72;
  const body = Math.floor(inDimension / 12);
  const shannon = inDimension % 12;
  return { wave, protocol, surface, dimension, body, shannon };
}

export function composeBeat({ wave, protocol, surface, dimension, body, shannon }) {
  if (!Number.isInteger(wave) || wave < 0 || wave >= WAVE_COUNT) throw new RangeError(`composeBeat: wave 0..5 (got ${wave})`);
  if (!Number.isInteger(protocol) || protocol < 0 || protocol >= 6) throw new RangeError(`composeBeat: protocol 0..5 (got ${protocol})`);
  if (!Number.isInteger(surface) || surface < 0 || surface >= 6) throw new RangeError(`composeBeat: surface 0..5 (got ${surface})`);
  if (!Number.isInteger(dimension) || dimension < 0 || dimension >= 6) throw new RangeError(`composeBeat: dimension 0..5 (got ${dimension})`);
  if (!Number.isInteger(body) || body < 0 || body >= 6) throw new RangeError(`composeBeat: body 0..5 (got ${body})`);
  if (!Number.isInteger(shannon) || shannon < 0 || shannon >= SHANNON_POSITIONS) throw new RangeError(`composeBeat: shannon 0..11 (got ${shannon})`);
  return ((((wave * 6 + protocol) * 6 + surface) * 6 + dimension) * 6 + body) * 12 + shannon;
}

export function beatLabel(i) {
  const d = decomposeBeat(i);
  return `wave=${d.wave}(${WAVE_NAMES[d.wave]}) protocol=${PROTOCOL_NAMES[d.protocol]} surface=${SURFACE_NAMES[d.surface]} dim=${DIMENSION_NAMES[d.dimension]} body=${BODY_NAMES[d.body]} shannon=${d.shannon}`;
}

export function roomId({ idx, vantage = 'acer', controllerCount = 100, flywheelCount = 100 }) {
  const max = controllerCount * flywheelCount;
  if (!Number.isInteger(idx) || idx < 0 || idx >= max) {
    throw new RangeError(`roomId: idx must be integer in [0, ${max}) (got ${idx})`);
  }
  const controller = idx % controllerCount;
  const flywheel = Math.floor(idx / controllerCount);
  return `${vantage}-room-R${String(idx).padStart(5, '0')}-C${String(controller).padStart(2, '0')}-F${String(flywheel).padStart(2, '0')}`;
}

export function parseRoomId(id) {
  const m = id.match(/^([a-z-]+)-room-R(\d+)-C(\d+)-F(\d+)$/);
  if (!m) throw new TypeError(`parseRoomId: invalid format (got ${id})`);
  return { vantage: m[1], idx: Number(m[2]), controller: Number(m[3]), flywheel: Number(m[4]) };
}

// Filter: which rooms are active for a given beat.
// Default policy: all rooms active for all beats (full cross-product).
// Caller may pass alternative policies for sparse cascades.
export function roomActiveForBeat({ roomIdx, beatIdx, policy = 'all', roomCount = 10_000 }) {
  if (policy === 'all') return true;
  if (policy === 'body-match-modulo-6') {
    const { body } = decomposeBeat(beatIdx);
    return roomIdx % 6 === body;
  }
  if (policy === 'protocol-match-modulo-6') {
    const { protocol } = decomposeBeat(beatIdx);
    return roomIdx % 6 === protocol;
  }
  throw new RangeError(`roomActiveForBeat: unknown policy ${policy}`);
}

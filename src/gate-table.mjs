// Gate table for the helm and its spawned sub-agents.
//
// Spec: C:\AGENT.md Step 3 (inviolable) + Step 7 (gates).
//
// Hard gates the helm MUST honor:
//   - operator-witness  : USB writes, daemon-start, MEMORY.md writes, PR push,
//                         shell-profile install
//   - apex-mint         : cp mints (subset of quintuple)
//   - quintuple-cosign  : 5-cosigner ceremony
//   - bilateral-sync    : both vantages agree before commit
//
// classifyOp returns a stable object so call sites can branch on the named
// predicates instead of stringly typed verdict comparisons.

const APEX_VERBS = new Set(['cp-mint', 'mint-cp', 'atlas-cp-mint']);
const WITNESS_VERBS = new Set([
  'daemon-start',
  'daemon-restart',
  'daemon-stop',
  'git-push',
  'shell-profile-install',
]);
const READ_ONLY_VERBS = new Set([
  'file-read',
  'fabric-query',
  'directory-list',
  'http-get',
  'sha256',
]);

const MEMORY_MD_RE = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]MEMORY\.md$/i;
const SOVLINUX_RE = /^(SOVLINUX[-_]2TB|sovlinux-2tb)[:/]/i;

function isSovlinuxTarget(target) {
  if (!target) return false;
  return SOVLINUX_RE.test(String(target));
}

function isUsbTarget(input) {
  if (!input) return false;
  if (typeof input === 'object' && input.usb === true) return true;
  return false;
}

function isMemoryMd(target) {
  if (!target) return false;
  return MEMORY_MD_RE.test(String(target));
}

export function classifyOp(op) {
  const verb = op?.verb ?? '';
  const target = op?.target ?? '';
  const flags = {
    apex: false,
    witness: false,
    bilateral: false,
    free: false,
    reason: null,
  };

  if (APEX_VERBS.has(verb)) {
    flags.apex = true;
    flags.reason = 'apex-mint';
    return { ...op, gate: flags };
  }

  if (WITNESS_VERBS.has(verb)) {
    flags.witness = true;
    flags.reason = `witness:${verb}`;
    return { ...op, gate: flags };
  }

  if (isSovlinuxTarget(target)) {
    flags.witness = true;
    flags.reason = 'witness:sovlinux-write';
    return { ...op, gate: flags };
  }

  if (isUsbTarget(op) && /write|append|mint|emit/i.test(verb)) {
    flags.witness = true;
    flags.reason = 'witness:usb-write';
    return { ...op, gate: flags };
  }

  if (isMemoryMd(target) && /write|append|edit/i.test(verb)) {
    flags.witness = true;
    flags.reason = 'witness:memory-md-write';
    return { ...op, gate: flags };
  }

  if (READ_ONLY_VERBS.has(verb)) {
    flags.free = true;
    flags.reason = 'read-only';
    return { ...op, gate: flags };
  }

  // Default: regular file writes / non-gated ops are free.
  flags.free = true;
  flags.reason = 'unclassified-free';
  return { ...op, gate: flags };
}

export function requiresWitness(classified) {
  return classified?.gate?.witness === true;
}

export function requiresApex(classified) {
  return classified?.gate?.apex === true;
}

export function requiresBilateral(classified) {
  return classified?.gate?.bilateral === true;
}

export function isFreeOp(classified) {
  return classified?.gate?.free === true && !classified?.gate?.witness && !classified?.gate?.apex;
}

// github-commit-emitter.mjs — LEG-3 of the multi-substrate fabric: GitHub as a
// MIDDLE-GROUND RAM bus between vantages (operator: "we already started to do that").
//
// The bus semantics, the bigpickle way:
//   commit = EMIT   (one HBP envelope -> one file -> one commit, deterministic path)
//   git log = READ  (pull the bus by reading the committed envelopes)
//   push    = PUBLISH (OUTWARD-FACING -> DOUBLE-GATED {push, confirmed}; never auto-fired)
//
// Honest boundaries (tonight's discipline): the commit=emit / log=read mechanism is
// fully real + testable LOCALLY (no network). The remote push to a GitHub repo is the
// only outward step and it is gated — I prove the mechanism, I do not publish unasked.
// HBP only on the wire. Operator: Jesse Daniel Brown — "GitHub as a middle ground" 2026-06-01.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export function sha256hex(s) { return createHash('sha256').update(String(s)).digest('hex'); }
export function sha8(s) { return sha256hex(s).slice(0, 8); }

function git(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

// deterministic bus path: <prefix>/<sha8(roomPid)>-<seq6>.hbp  (commit=emit address)
export function busPath(roomPid, seq, prefix = 'bus') {
  return `${prefix}/${sha8(roomPid)}-${String(seq).padStart(6, '0')}.hbp`;
}

// COMMIT = EMIT: write one HBP envelope, git add + commit. Returns the receipt (no push).
export function commitEnvelope(repoDir, { roomPid, seq, envelope }, opts = {}) {
  const rel = busPath(roomPid, seq, opts.prefix);
  const abs = join(repoDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const body = String(envelope).endsWith('\n') ? String(envelope) : String(envelope) + '\n';
  writeFileSync(abs, body, 'utf8');
  git(repoDir, ['add', '--', rel]);
  const msg = `bus-emit|pid=${roomPid}|seq=${seq}|sha8=${sha8(body)}|json=0`;
  git(repoDir, ['commit', '-m', msg, '--no-verify']);   // bus emit: no hooks, no signing prompt
  const commit = git(repoDir, ['rev-parse', 'HEAD']);
  return { emitted: true, path: rel, commit, sha8: sha8(body), message: msg };
}

// git log = READ: pull the bus by listing committed envelopes (newest first).
export function readBus(repoDir, opts = {}) {
  const prefix = opts.prefix || 'bus';
  let out = '';
  try { out = git(repoDir, ['log', '--oneline', '--no-color', '--', prefix]); } catch { out = ''; }
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((l) => {
    const sp = l.indexOf(' ');
    return { commit: l.slice(0, sp), message: l.slice(sp + 1) };
  });
}

// PUSH = PUBLISH: the ONLY outward action. DOUBLE-GATED — never fires without
// {push:true, confirmed:true}. Mirrors the real-agent-fire double gate.
export function pushBus(repoDir, opts = {}) {
  if (!opts.push || !opts.confirmed) {
    return { pushed: false, gated: true, reason: 'remote push is OUTWARD-FACING (publishes to GitHub) — requires {push:true, confirmed:true}; mechanism proven locally, publish is operator-gated' };
  }
  const out = git(repoDir, ['push', opts.remote || 'origin', opts.branch || 'HEAD']);
  return { pushed: true, remote: opts.remote || 'origin', out };
}

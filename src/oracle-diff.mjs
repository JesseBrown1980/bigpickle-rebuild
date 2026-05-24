// Oracle diff — wire-level comparison between the rebuild and a black-box
// reference (e.g. the quarantined originals invoked via shell, never read).
//
// Spec: TESTS-PLAN.md Layer 6 — "Submit identical envelope to (a) rebuild and
// (b) quarantined oracle via wire-level invocation only. Diff outputs at SHA256
// level. Never read the oracle's source to explain a diff — fix from spec."
//
// White-room firewall: this module NEVER reads quarantined source. It accepts
// an `oracleFn` callable that may shell out to anything; the source of that
// callable is the caller's choice.

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { serializeEnvelope } from './hbp-emitter.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function diffOutputs(rebuildInput, oracleInput) {
  const rebuildBuf = Buffer.from(rebuildInput);
  const oracleBuf = Buffer.from(oracleInput);
  const rebuildSha = sha256(rebuildBuf);
  const oracleSha = sha256(oracleBuf);
  const match = rebuildSha === oracleSha;
  let byteDivergence = 0;
  if (!match) {
    const minLen = Math.min(rebuildBuf.length, oracleBuf.length);
    for (let i = 0; i < minLen; i++) {
      if (rebuildBuf[i] !== oracleBuf[i]) byteDivergence++;
    }
    byteDivergence += Math.abs(rebuildBuf.length - oracleBuf.length);
  }
  const maxLen = Math.max(rebuildBuf.length, oracleBuf.length);
  return {
    match,
    rebuildSha,
    oracleSha,
    rebuildBytes: rebuildBuf.length,
    oracleBytes: oracleBuf.length,
    byteDivergence,
    divergencePct: maxLen ? (byteDivergence / maxLen) * 100 : 0,
  };
}

export async function compareWithOracle(envelope, oracleFn) {
  if (typeof oracleFn !== 'function') {
    throw new TypeError('compareWithOracle: oracleFn must be a function');
  }
  const oracleOutput = await oracleFn(envelope);
  const rebuildOutput = serializeEnvelope(envelope);
  return diffOutputs(Buffer.from(rebuildOutput, 'utf8'), Buffer.from(oracleOutput));
}

// Convenience for the canonical "operator-acceptable divergence" gate.
// 0.01 % per TESTS-PLAN.md Layer 6 promotion criterion.
export function isWithinPromotionGate(diff, gatePct = 0.01) {
  return diff.divergencePct <= gatePct;
}

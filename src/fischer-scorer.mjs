// fischer-scorer.mjs — FischerScorer: the anti-blunder evaluator as a SCORER.
//
// Drop-in for the white-room scorer chain (alongside DeterministicScorer +
// L0GnnScorer). Where those score "does this address/content matter", the
// FischerScorer scores "is this a sound MOVE" — it runs the 7-GNN score, then
// the Fischer Kernel, and folds the verdict + centipawn-loss (cpl) into one
// bounded [0,1] score:
//
//   PROCEED (cpl<150)  → high   (≈ 0.85–1.0)   genius / best legal move
//   HOLD/ANALYZE       → mid    (≈ 0.50–0.85)  playable, needs cosign/white-room
//   BLOCK/REFUTE       → low    (< 0.50)       blunder / illegal / refuted
//
// Pure-ish: the only impurity is the GNN HTTP query inside scorePrimitive; pass
// a mock scoreFn to make it fully deterministic (used by the unit tests).

import { score as scorePrimitive } from './asolaria-score.mjs';
import { fischerEval, VERDICT } from './fischer-kernel.mjs';

const VERDICT_MARK = Object.freeze({
  [VERDICT.PROCEED]: 'GENIUS',
  [VERDICT.HOLD]: 'HOLD',
  [VERDICT.ANALYZE]: 'ANALYZE',
  [VERDICT.BLOCK]: 'MISTAKE',
  [VERDICT.REFUTE]: 'MISTAKE',
});

// Map a Fischer centipawn-loss to a bounded [0,1] score (monotonic, clamped).
export function cplToScore(cpl) {
  const n = Number(cpl);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, 1 - n / 1000));
}

function envContent(envelope) {
  if (typeof envelope === 'string') return envelope;
  if (envelope && typeof envelope === 'object') {
    return String(envelope.content ?? envelope.answer ?? JSON.stringify(envelope));
  }
  return '';
}

export class FischerScorer {
  constructor({ name = 'fischer', scoreFn = scorePrimitive } = {}) {
    this.name = name;
    this._score = scoreFn;
  }

  // Full evaluation: score + fischer verdict + the sealed FISCHERv1 row.
  async evaluate(pid, envelope, opts = {}) {
    const content = envContent(envelope);
    // The score primitive is HTTP-resilient, but guard anyway so evaluate()
    // truly never throws — a failed scorer degrades to a deterministic-only score.
    let sc;
    try {
      sc = await this._score(pid, content, opts);
    } catch {
      sc = { composite: 0, signals: {}, provenance: 'score-failed', g4_state: null };
    }
    const env =
      envelope && typeof envelope === 'object' ? envelope : { verb: 'score', content };
    const f = fischerEval(pid, env, sc, opts);
    return {
      score: cplToScore(f.cpl),
      verdict: f.verdict,
      cpl: f.cpl,
      mark: VERDICT_MARK[f.verdict] || 'MISTAKE',
      pass: f.pass,
      composite: sc.composite,
      g4_state: sc.g4_state || null,
      provenance: `${sc.provenance || 'baseline-only'}+fischer`,
      fischer: f, // { verdict, cpl, row, rowHash, hbi, axes, ... }
    };
  }

  // White-room scorer interface: returns a bounded [0,1] number.
  async score(pid, envelope, opts = {}) {
    return (await this.evaluate(pid, envelope, opts)).score;
  }
}

// Functional shorthand.
export async function fischerScore(pid, envelope, opts = {}) {
  return new FischerScorer().evaluate(pid, envelope, opts);
}

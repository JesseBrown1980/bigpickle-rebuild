// PID-chain revolver — the per-request rotor that gives BigPickle its
// throughput multiplier inside a single authenticated connection.
//
// Spec: project_bigpickle_pid_chain_revolver_canonical_multiplex_pattern_2026_05_24
//
// One revolver per execution context (e.g. one OpenCode child). Each .next()
// call mints a fresh PID via the white-room minter, deterministically derived
// from (anchor, counter).

import { mintPID } from './pid-minter.mjs';
import { primeAt } from './primes.mjs';

const LANE_CYCLE = ['nervous', 'circulatory', 'skeletal', 'muscular', 'immune', 'memory'];

export class PIDChainRevolver {
  constructor(opts = {}) {
    if (!opts.anchor || typeof opts.anchor !== 'string') {
      throw new TypeError('PIDChainRevolver: opts.anchor (string) required');
    }
    this.anchor = opts.anchor;
    this.counter = 0;
    this.alphabet = opts.alphabet ?? 256;
    this.mintPID = opts.mintPID ?? mintPID;
    this.primeAt = opts.primeAt ?? primeAt;
  }

  next() {
    const i = this.counter;
    const pid = this.mintPID({
      actor: i % this.alphabet,
      device: this.anchor,
      lane: LANE_CYCLE[i % LANE_CYCLE.length],
      prime: this.primeAt(i % 1000),
      alphabet: this.alphabet,
    });
    this.counter++;
    return pid;
  }

  reset() {
    this.counter = 0;
  }
}

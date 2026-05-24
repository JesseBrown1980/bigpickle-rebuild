// Hookwall — the gate every envelope must pass before fanout.
// Spec: memory project_three_keys_hookwall_pid_gnn_loop_closure (hookwall is
// one of the three keys to loop closure) + feedback_frontend_agent_is_router_not_worker
// (gate runs in front of every emission).
//
// The gate validates required fields, tags the envelope with provenance, and
// rejects malformed envelopes loudly. It does NOT make policy decisions about
// the payload — that is the role of downstream GNN scoring.

import { TUPLE_DIMS } from './tuple-tag.mjs';

const REQUIRED_FIELDS = ['type', 'tupleTag'];

export class Hookwall {
  constructor(opts = {}) {
    this.name = opts.name ?? 'hookwall-default';
    this.passedCount = 0;
    this.rejectedCount = 0;
  }

  pass(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      this.rejectedCount++;
      throw new TypeError('hookwall: envelope must be a non-array object');
    }
    for (const field of REQUIRED_FIELDS) {
      if (!(field in envelope)) {
        this.rejectedCount++;
        throw new Error(`hookwall: envelope missing required field "${field}"`);
      }
    }
    if (typeof envelope.type !== 'string' || envelope.type.length === 0) {
      this.rejectedCount++;
      throw new TypeError('hookwall: envelope.type must be a non-empty string');
    }
    if (!Array.isArray(envelope.tupleTag)) {
      this.rejectedCount++;
      throw new TypeError('hookwall: envelope.tupleTag must be an array');
    }
    if (envelope.tupleTag.length > TUPLE_DIMS) {
      this.rejectedCount++;
      throw new RangeError(
        `hookwall: envelope.tupleTag length ${envelope.tupleTag.length} exceeds ${TUPLE_DIMS}`
      );
    }
    this.passedCount++;
    return {
      ...envelope,
      gate: this.name,
      passed_at: Date.now(),
    };
  }
}

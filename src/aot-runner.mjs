// AoT (Algorithm of Thought) runner — single-prompt tree search.
// Spec: C:/asolaria-foundation-v1/04-AOT-ALGORITHM-OF-THOUGHT.md
//
// One LLM call. Branches explored, scored, and pruned inside the model's
// context. Branch outcomes optionally appended to a GNN edge ledger for
// nightly self-train.

import { mintPID } from './pid-minter.mjs';
import { primeAt } from './primes.mjs';

const RESPONSE_MAGIC = '!AOT-RESPONSE-v0';
const RESPONSE_END = '!end';

function buildAoTPrompt(envelope) {
  const lines = [
    '!AOT-QUERY-v0',
    `task=${envelope.task ?? ''}`,
    `scoring_function=${envelope.scoring_function ?? 'gnn-heuristic'}`,
    `max_depth=${envelope.max_depth ?? 5}`,
    `max_branches=${envelope.max_branches ?? 7}`,
    `prune_threshold=${envelope.prune_threshold ?? 0.3}`,
    '[branches]',
    ...envelope.branches.map((b, i) => `branch-${i}=${b}`),
    '!end',
  ];
  return lines.join('\n');
}

export function parseAoTResponse(text) {
  if (typeof text !== 'string') {
    throw new TypeError('parseAoTResponse: text must be string');
  }
  const lines = text.split(/\r?\n/);
  if (!lines[0].startsWith(RESPONSE_MAGIC)) {
    throw new Error(`parseAoTResponse: expected magic ${RESPONSE_MAGIC}, got ${lines[0]}`);
  }
  const scores = [];
  let chosen = null;
  let tokens = 0;
  for (const line of lines) {
    if (line === RESPONSE_MAGIC || line === RESPONSE_END) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1);
    if (key === 'chosen') {
      chosen = val;
    } else if (key === 'tokens') {
      tokens = parseInt(val, 10);
    } else if (key.startsWith('score:branch-')) {
      const idx = parseInt(key.slice('score:branch-'.length), 10);
      scores[idx] = parseFloat(val);
    }
  }
  return { chosen, scores, tokens };
}

export async function runAoT(envelope, deps) {
  if (!envelope || envelope.envelope_type !== 'AOT_QUERY') {
    throw new TypeError('runAoT: envelope.envelope_type must be AOT_QUERY');
  }
  if (!Array.isArray(envelope.branches) || envelope.branches.length === 0) {
    throw new TypeError('runAoT: envelope.branches must be a non-empty array');
  }
  if (!deps || typeof deps.llm !== 'function') {
    throw new TypeError('runAoT: deps.llm function is required');
  }
  const mint = deps.mintPID ?? mintPID;
  const primes = deps.primeAt ?? primeAt;

  const prompt = buildAoTPrompt(envelope);
  const response = await deps.llm({
    prompt,
    maxTokens: envelope.max_total_tokens ?? 10_000,
  });
  const parsed = parseAoTResponse(response);

  // Mint a fresh PID per branch — formula-derivable from (envelope.pid_anchor, branch index).
  const device = envelope.pid_anchor ?? 'aot-default-anchor';
  const branchPids = envelope.branches.map((_, i) =>
    mint({
      actor: i % 256,
      device,
      lane: 'memory',
      prime: primes(i),
    })
  );

  const pruneThreshold = envelope.prune_threshold ?? 0.3;
  const branchOutcomes = envelope.branches.map((branch, i) => ({
    pid: branchPids[i],
    branch,
    score: parsed.scores[i] ?? 0,
    pruned: (parsed.scores[i] ?? 0) < pruneThreshold,
  }));

  if (envelope.record_branches_as_edges && deps.gnnEdgeLedger) {
    for (const outcome of branchOutcomes) {
      deps.gnnEdgeLedger.append({
        from: envelope.pid_anchor ?? 'aot-default-anchor',
        to: outcome.pid,
        branch: outcome.branch,
        score: outcome.score,
        pruned: outcome.pruned,
        scoring_function: envelope.scoring_function ?? 'gnn-heuristic',
      });
    }
  }

  return {
    chosen: parsed.chosen,
    branch_pids: branchPids,
    branch_outcomes: branchOutcomes,
    token_cost: parsed.tokens,
    llm_calls: 1,
  };
}

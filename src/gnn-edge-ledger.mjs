// In-memory GNN edge ledger. AoT branch outcomes append here when the
// envelope sets record_branches_as_edges = true. The ledger is the input
// to nightly self-train per 04-AOT-ALGORITHM-OF-THOUGHT.md.

export function createGNNEdgeLedger() {
  const entries = [];
  return {
    get entries() {
      return entries.slice();
    },
    get size() {
      return entries.length;
    },
    append(edge) {
      if (!edge || typeof edge !== 'object') {
        throw new TypeError('gnn-edge-ledger: edge must be an object');
      }
      entries.push({ ...edge, recorded_at: Date.now() });
      return entries.length;
    },
    clear() {
      entries.length = 0;
    },
  };
}

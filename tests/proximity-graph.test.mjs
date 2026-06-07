// Unit tests for proximity-graph.mjs
// Spec: arxiv:2502.18864 §3.3.4 Proximity agent

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHA16_HEX_LEN,
  SHA16_BIT_LEN,
  hammingDistance,
  pidSimilarity,
  buildProximityGraph,
  clusterByProximity,
  dedupHypotheses,
  prioritizedPairsForTournament,
  toGraphRow,
  toClusterRow,
} from '../src/proximity-graph.mjs';

// --- helpers ---------------------------------------------------------------
const ZEROS = '0000000000000000';
const ONES  = 'ffffffffffffffff';

function h(pid, label = '') {
  return { pid, label };
}

// --- hammingDistance -------------------------------------------------------

test('hammingDistance: identical pids = 0', () => {
  assert.equal(hammingDistance(ZEROS, ZEROS), 0);
  assert.equal(hammingDistance(ONES, ONES), 0);
  assert.equal(hammingDistance('0123456789abcdef', '0123456789abcdef'), 0);
});

test('hammingDistance: all-zero vs all-one = 64 (upper bound)', () => {
  assert.equal(hammingDistance(ZEROS, ONES), SHA16_BIT_LEN);
  assert.equal(hammingDistance(ONES, ZEROS), SHA16_BIT_LEN);
});

test('hammingDistance: single-bit difference = 1', () => {
  // 0x0 vs 0x1 differs in 1 bit, rest of nibbles identical.
  assert.equal(hammingDistance('0000000000000000', '0000000000000001'), 1);
  // High-end nibble: 0x0 vs 0x8 (1000) is 1 bit.
  assert.equal(hammingDistance('8000000000000000', '0000000000000000'), 1);
});

test('hammingDistance: symmetric', () => {
  const a = 'deadbeefcafef00d';
  const b = '0123456789abcdef';
  assert.equal(hammingDistance(a, b), hammingDistance(b, a));
});

test('hammingDistance: case-insensitive', () => {
  assert.equal(hammingDistance('DEADBEEFCAFEF00D', 'deadbeefcafef00d'), 0);
});

test('hammingDistance: rejects malformed input', () => {
  assert.throws(() => hammingDistance('short', ZEROS), TypeError);
  assert.throws(() => hammingDistance(ZEROS, 'zzzz000000000000'), TypeError);
  assert.throws(() => hammingDistance(null, ZEROS), TypeError);
  assert.throws(() => hammingDistance(ZEROS, 12345), TypeError);
});

test('SHA16 length constants are consistent', () => {
  assert.equal(SHA16_HEX_LEN, 16);
  assert.equal(SHA16_BIT_LEN, 64);
  assert.equal(SHA16_HEX_LEN * 4, SHA16_BIT_LEN);
});

// --- pidSimilarity ---------------------------------------------------------

test('pidSimilarity: bounded in [0, 1]', () => {
  const pairs = [
    [ZEROS, ZEROS], [ZEROS, ONES],
    ['deadbeefcafef00d', '0123456789abcdef'],
    ['aaaaaaaaaaaaaaaa', '5555555555555555'],
    ['1111111111111111', '2222222222222222'],
  ];
  for (const [a, b] of pairs) {
    const s = pidSimilarity(a, b);
    assert.ok(s >= 0 && s <= 1, `sim(${a},${b})=${s} out of [0,1]`);
  }
});

test('pidSimilarity: symmetric a,b == b,a', () => {
  const a = 'deadbeefcafef00d';
  const b = '0123456789abcdef';
  assert.equal(pidSimilarity(a, b), pidSimilarity(b, a));
});

test('pidSimilarity: identical pids = 1.0', () => {
  assert.equal(pidSimilarity(ZEROS, ZEROS), 1.0);
  assert.equal(pidSimilarity('deadbeefcafef00d', 'deadbeefcafef00d'), 1.0);
});

test('pidSimilarity: maximally different pids = 0.0', () => {
  assert.equal(pidSimilarity(ZEROS, ONES), 0.0);
});

test('pidSimilarity: 1-bit diff = 1 - 1/64', () => {
  assert.equal(pidSimilarity('0000000000000000', '0000000000000001'), 1 - 1 / 64);
});

// --- buildProximityGraph ---------------------------------------------------

test('buildProximityGraph: 5 hypotheses, edge count consistency', () => {
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'), // very close to #0
    h('ffffffffffffffff'),
    h('fffffffffffffffe'), // very close to #2
    h('aaaaaaaaaaaaaaaa'), // half-ones, middle
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.4 });
  // Vertex count = 5 unique.
  assert.equal(graph.size, 5);
  // Sum of adjacency-set sizes is 2 * |E| in undirected graph.
  let degSum = 0;
  for (const set of graph.values()) degSum += set.size;
  assert.equal(degSum % 2, 0, 'undirected: degree sum must be even');
  // No self-edges.
  for (const [pid, set] of graph.entries()) {
    assert.equal(set.has(pid), false, `self-edge on ${pid}`);
  }
  // At least one edge (#0 close to #1, #2 close to #3 both at sim ≈ 63/64).
  assert.ok(degSum / 2 >= 2, 'expected ≥ 2 edges in this fixture');
});

test('buildProximityGraph: threshold=1.0 → no actual edges (only vertex set)', () => {
  // sim ≥ 1.0 requires identical pids. Distinct pids cannot match.
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'),
    h('aaaaaaaaaaaaaaaa'),
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 1.0 });
  assert.equal(graph.size, 3);
  let edgeCount = 0;
  for (const set of graph.values()) edgeCount += set.size;
  assert.equal(edgeCount, 0, 'no edges at threshold=1.0 for distinct pids');
});

test('buildProximityGraph: identical pids collapse to one vertex', () => {
  const hyps = [h('0000000000000000'), h('0000000000000000')];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.4 });
  assert.equal(graph.size, 1);
});

test('buildProximityGraph: rejects bad input', () => {
  assert.throws(() => buildProximityGraph({}), TypeError);
  assert.throws(() => buildProximityGraph({ hypotheses: [{}] }), TypeError);
  assert.throws(() => buildProximityGraph({ hypotheses: [], threshold: NaN }), TypeError);
});

// --- clusterByProximity ----------------------------------------------------

test('clusterByProximity: 3 isolated hypotheses → 3 clusters', () => {
  // Use 3 pids far apart in Hamming space.
  const hyps = [
    h('0000000000000000'),
    h('ffffffffffffffff'),
    h('aaaaaaaaaaaaaaaa'), // 32 bits diff from both ZEROS and ONES → sim 0.5
  ];
  // High threshold (0.9) keeps them isolated.
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.9 });
  const clusters = clusterByProximity({ graph, hypotheses: hyps });
  assert.equal(clusters.length, 3);
  for (const c of clusters) assert.equal(c.length, 1);
});

test('clusterByProximity: 2 similar + 1 isolated → 1 cluster of 2 + 1 singleton', () => {
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'), // sim 63/64 with #0
    h('ffffffffffffffff'), // sim 0 with #0, 1/64 with #1
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.9 });
  const clusters = clusterByProximity({ graph, hypotheses: hyps });
  // Sort by length DESC for determinism.
  clusters.sort((a, b) => b.length - a.length);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].length, 2);
  assert.equal(clusters[1].length, 1);
  // The doublet contains #0 and #1; singleton is #2.
  assert.ok(clusters[0].includes('0000000000000000'));
  assert.ok(clusters[0].includes('0000000000000001'));
  assert.equal(clusters[1][0], 'ffffffffffffffff');
});

test('clusterByProximity: transitive chain forms one cluster', () => {
  // a—b—c where a-c may or may not exceed threshold, but BFS still unifies.
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'),
    h('0000000000000003'), // 1-bit from #1 (bit 1), 2-bit from #0
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 1 - 2 / 64 });
  const clusters = clusterByProximity({ graph, hypotheses: hyps });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].length, 3);
});

// --- dedupHypotheses -------------------------------------------------------

test('dedupHypotheses: 2 very-similar + 1 unique → 2 hypotheses', () => {
  const hyps = [
    h('0000000000000000', 'first'),
    h('0000000000000001', 'second'),  // sim 63/64 ≥ 0.9 with #0
    h('ffffffffffffffff', 'third'),
  ];
  const result = dedupHypotheses({ hypotheses: hyps, threshold: 0.9 });
  assert.equal(result.length, 2);
  // First representative is input #0 (cluster order preserves first-seen).
  assert.equal(result[0].label, 'first');
  assert.equal(result[1].label, 'third');
});

test('dedupHypotheses: low threshold collapses everything (within sim of fixture)', () => {
  // Two pids near zero, one pid near ones — at threshold 0 ALL edges exist,
  // so connected-component dedup returns 1.
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'),
    h('ffffffffffffffff'),
  ];
  const result = dedupHypotheses({ hypotheses: hyps, threshold: 0.0 });
  assert.equal(result.length, 1);
});

// --- prioritizedPairsForTournament -----------------------------------------

test('prioritizedPairsForTournament: pairs sorted by similarity DESC', () => {
  const hyps = [
    h('0000000000000000'),
    h('0000000000000001'), // sim ≈ 0.984 with #0
    h('00000000000000ff'), // sim ≈ 0.875 with #0
    h('000000000000ffff'), // sim ≈ 0.75 with #0
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.5 });
  const pairs = prioritizedPairsForTournament({ graph, hypotheses: hyps, topK: 10 });
  assert.ok(pairs.length >= 1);
  for (let i = 1; i < pairs.length; i++) {
    assert.ok(
      pairs[i - 1].similarity >= pairs[i].similarity,
      `pair[${i - 1}].sim=${pairs[i - 1].similarity} < pair[${i}].sim=${pairs[i].similarity}`,
    );
  }
  // Priority field tracks rank index.
  for (let i = 0; i < pairs.length; i++) {
    assert.equal(pairs[i].priority, i);
  }
});

test('prioritizedPairsForTournament: respects topK limit', () => {
  const hyps = [];
  for (let i = 0; i < 8; i++) {
    hyps.push(h(i.toString(16).padStart(16, '0')));
  }
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.0 });
  const pairs = prioritizedPairsForTournament({ graph, hypotheses: hyps, topK: 3 });
  assert.equal(pairs.length, 3);
  const pairsBig = prioritizedPairsForTournament({ graph, hypotheses: hyps, topK: 100 });
  // With 8 vertices and threshold 0 fully connected (no self), edges = 8*7/2 = 28.
  assert.equal(pairsBig.length, 28);
});

test('prioritizedPairsForTournament: topK=0 returns empty', () => {
  const hyps = [h(ZEROS), h(ONES)];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.0 });
  const pairs = prioritizedPairsForTournament({ graph, hypotheses: hyps, topK: 0 });
  assert.deepEqual(pairs, []);
});

test('prioritizedPairsForTournament: empty graph returns empty', () => {
  const pairs = prioritizedPairsForTournament({ graph: new Map(), hypotheses: [], topK: 10 });
  assert.deepEqual(pairs, []);
});

// --- HBPv1 pipe-row serializers --------------------------------------------

test('toGraphRow: emits HBPv1 pipe-row format (no JSON braces, no quotes)', () => {
  const row = toGraphRow({
    a: '0000000000000000',
    b: '0000000000000001',
    similarity: 1 - 1 / 64,
  });
  assert.ok(row.startsWith('PROX-EDGE|'));
  assert.ok(!row.includes('{'));
  assert.ok(!row.includes('}'));
  assert.ok(!row.includes('"'));
  assert.ok(row.includes('a=0000000000000000'));
  assert.ok(row.includes('b=0000000000000001'));
  assert.ok(row.includes('similarity='));
  assert.ok(row.includes('hamming=1'));
});

test('toGraphRow: honors caller-supplied hamming, else derives it', () => {
  const row1 = toGraphRow({ a: ZEROS, b: '0000000000000001', similarity: 0.984375, hamming: 1 });
  assert.ok(row1.includes('hamming=1'));
  const row2 = toGraphRow({ a: ZEROS, b: '0000000000000003', similarity: 0.96875 });
  assert.ok(row2.includes('hamming=2'));
});

test('toClusterRow: emits HBPv1 pipe-row format', () => {
  const row = toClusterRow(['0000000000000000', '0000000000000001'], 0);
  assert.ok(row.startsWith('PROX-CLUSTER|'));
  assert.ok(!row.includes('{'));
  assert.ok(!row.includes('}'));
  assert.ok(!row.includes('"'));
  assert.equal(
    row,
    'PROX-CLUSTER|id=0|size=2|members=0000000000000000,0000000000000001',
  );
});

test('toClusterRow + toGraphRow: rejects bad input', () => {
  assert.throws(() => toGraphRow(null), TypeError);
  assert.throws(() => toGraphRow({ a: 'x', b: 'y' }), TypeError);
  assert.throws(() => toClusterRow([], 0), TypeError);
  assert.throws(() => toClusterRow(['x'], -1), TypeError);
  assert.throws(() => toClusterRow([42], 0), TypeError);
});

// --- end-to-end smoke ------------------------------------------------------

test('end-to-end: build → cluster → prioritize → emit rows', () => {
  const hyps = [
    h('0000000000000000', 'A'),
    h('0000000000000001', 'A-twin'),
    h('ffffffffffffffff', 'B'),
    h('fffffffffffffffe', 'B-twin'),
    h('aaaaaaaaaaaaaaaa', 'mid'),
  ];
  const graph = buildProximityGraph({ hypotheses: hyps, threshold: 0.9 });
  const clusters = clusterByProximity({ graph, hypotheses: hyps });
  const pairs = prioritizedPairsForTournament({ graph, hypotheses: hyps, topK: 10 });

  // Expect 3 clusters: {A, A-twin}, {B, B-twin}, {mid}.
  assert.equal(clusters.length, 3);
  const sizes = clusters.map((c) => c.length).sort();
  assert.deepEqual(sizes, [1, 2, 2]);

  // Two intra-twin edges expected at threshold 0.9.
  assert.equal(pairs.length, 2);
  for (const p of pairs) {
    const row = toGraphRow(p);
    assert.match(row, /^PROX-EDGE\|a=[0-9a-f]{16}\|b=[0-9a-f]{16}\|similarity=\d\.\d{4}\|hamming=\d+$/);
  }
  const clusterRows = clusters.map((c, i) => toClusterRow(c, i));
  for (const r of clusterRows) {
    assert.match(r, /^PROX-CLUSTER\|id=\d+\|size=\d+\|members=[0-9a-f,]+$/);
  }
});

// Unit tests for the Elo tournament module — Co-Scientist Ranking-agent
// equivalent (arxiv:2502.18864 §3.3.3). Pure-function coverage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initElo,
  expectedScore,
  updateElo,
  compareHypothesesPairwise,
  runTournament,
  toMatchRow,
  ELO_OUTCOMES,
  _internals,
} from '../src/elo-tournament.mjs';

// =================== initElo ===================

test('initElo returns exactly 1200 per §3.3.3', () => {
  assert.equal(initElo(), 1200);
});

// =================== expectedScore ===================

test('expectedScore symmetry: E_A + E_B === 1 when equal Elos', () => {
  const eA = expectedScore(1500, 1500);
  const eB = expectedScore(1500, 1500);
  assert.equal(eA + eB, 1);
  assert.equal(eA, 0.5);
});

test('expectedScore favors higher Elo', () => {
  const eHigh = expectedScore(1800, 1200);
  const eLow = expectedScore(1200, 1800);
  assert.ok(eHigh > 0.9, `eHigh ${eHigh} should be > 0.9`);
  assert.ok(eLow < 0.1, `eLow ${eLow} should be < 0.1`);
  assert.ok(Math.abs(eHigh + eLow - 1) < 1e-12, 'symmetric pair must sum to 1');
});

test('expectedScore throws on non-finite input', () => {
  assert.throws(() => expectedScore(NaN, 1200), TypeError);
  assert.throws(() => expectedScore(1200, Infinity), TypeError);
});

// =================== updateElo zero-sum ===================

test('updateElo zero-sum on DRAW between equal Elos: deltas exactly opposite (both zero)', () => {
  const { eloA, eloB, deltaA, deltaB } = updateElo(1500, 1500, ELO_OUTCOMES.DRAW);
  assert.equal(eloA, 1500);
  assert.equal(eloB, 1500);
  assert.equal(deltaA, 0);
  assert.equal(deltaB, 0);
  assert.equal(deltaA + deltaB, 0);
});

test('updateElo zero-sum across any outcome: delta_A + delta_B === 0', () => {
  for (const outcome of [ELO_OUTCOMES.WIN_A, ELO_OUTCOMES.WIN_B, ELO_OUTCOMES.DRAW]) {
    for (const [a, b] of [[1200, 1200], [1400, 1100], [1100, 1600], [1800, 1200]]) {
      const { deltaA, deltaB } = updateElo(a, b, outcome);
      assert.ok(Math.abs(deltaA + deltaB) < 1e-9, `outcome ${outcome} elos (${a},${b}) sum ${deltaA + deltaB} not zero`);
    }
  }
});

test('updateElo upset: winner Elo increase exceeds 0.5*K when expectedScore < 0.5', () => {
  // A=1100, B=1500 — A is the underdog (expectedScore(A,B) < 0.5).
  // If A wins, A's gain should exceed K/2 = 16.
  const e = expectedScore(1100, 1500);
  assert.ok(e < 0.5, `precondition: expectedScore ${e} should be < 0.5`);
  const { eloA, deltaA } = updateElo(1100, 1500, ELO_OUTCOMES.WIN_A);
  assert.ok(deltaA > 16, `upset deltaA ${deltaA} should exceed K/2=16`);
  assert.ok(eloA > 1100, 'winner Elo must strictly increase');
});

test('updateElo expected outcome: favorite winning gains less than K/2', () => {
  // A=1500 beating B=1100 (favored), so gain < 16.
  const { deltaA } = updateElo(1500, 1100, ELO_OUTCOMES.WIN_A);
  assert.ok(deltaA > 0 && deltaA < 16, `favorite deltaA ${deltaA} should be in (0, 16)`);
});

test('updateElo respects custom kFactor', () => {
  const { deltaA: d32 } = updateElo(1200, 1200, ELO_OUTCOMES.WIN_A, 32);
  const { deltaA: d16 } = updateElo(1200, 1200, ELO_OUTCOMES.WIN_A, 16);
  assert.ok(Math.abs(d32 - 2 * d16) < 1e-9, 'doubling K should double the delta at equal Elos');
});

test('updateElo rejects bad outcome / kFactor', () => {
  assert.throws(() => updateElo(1200, 1200, 'BOGUS'), RangeError);
  assert.throws(() => updateElo(1200, 1200, ELO_OUTCOMES.DRAW, 0), RangeError);
  assert.throws(() => updateElo(NaN, 1200, ELO_OUTCOMES.DRAW), TypeError);
});

// =================== compareHypothesesPairwise determinism ===================

test('compareHypothesesPairwise single-turn deterministic: same input -> same winner', () => {
  const hypA = { pid: 'hyp-aaaa-0001' };
  const hypB = { pid: 'hyp-bbbb-0002' };
  const r1 = compareHypothesesPairwise({ hypA, hypB, mode: 'single-turn' });
  const r2 = compareHypothesesPairwise({ hypA, hypB, mode: 'single-turn' });
  const r3 = compareHypothesesPairwise({ hypA, hypB, mode: 'single-turn' });
  assert.equal(r1.winner, r2.winner);
  assert.equal(r2.winner, r3.winner);
  assert.ok(r1.winner === 'A' || r1.winner === 'B');
  assert.ok(r1.reason.includes('single-turn'));
});

test('compareHypothesesPairwise multi-turn deterministic + majority over 3 sub-rounds', () => {
  const hypA = { pid: 'hyp-x' };
  const hypB = { pid: 'hyp-y' };
  const r1 = compareHypothesesPairwise({ hypA, hypB, mode: 'multi-turn' });
  const r2 = compareHypothesesPairwise({ hypA, hypB, mode: 'multi-turn' });
  assert.equal(r1.winner, r2.winner);

  // Independently recompute the three sub-rounds' winners and confirm majority.
  const subWinners = [0, 1, 2].map((roundIdx) => {
    const key = `${hypA.pid}|${hypB.pid}|multi-turn|round=${roundIdx}|`;
    const bit = _internals.firstBitOfSha(key);
    return bit === 0 ? 'A' : 'B';
  });
  const aWins = subWinners.filter((w) => w === 'A').length;
  const expected = aWins > subWinners.length / 2 ? 'A' : 'B';
  assert.equal(r1.winner, expected, `majority of ${subWinners.join(',')} should be ${expected}`);
  assert.ok(r1.reason.includes('multi-turn'));
  assert.ok(r1.reason.includes('rounds=3'));
});

test('compareHypothesesPairwise rejects bad mode / missing pid', () => {
  assert.throws(() => compareHypothesesPairwise({ hypA: { pid: 'a' }, hypB: { pid: 'b' }, mode: 'epic' }), RangeError);
  assert.throws(() => compareHypothesesPairwise({ hypA: { pid: 'a' }, hypB: { foo: 'b' } }), TypeError);
});

// =================== toMatchRow pipe-row purity ===================

test('toMatchRow emits HBPv1 pipe-row with no JSON braces', () => {
  const row = toMatchRow({
    round: 0,
    hypA: 'hyp-aaa',
    hypB: 'hyp-bbb',
    mode: 'single-turn',
    eloABefore: 1200,
    eloBBefore: 1200,
    winner: 'A',
    eloAAfter: 1216,
    eloBAfter: 1184,
  });
  assert.match(row, /^MATCH\|/);
  assert.ok(!row.includes('{'));
  assert.ok(!row.includes('}'));
  assert.ok(!row.includes('"'));
  assert.match(row, /round=0/);
  assert.match(row, /hypA=hyp-aaa/);
  assert.match(row, /hypB=hyp-bbb/);
  assert.match(row, /mode=single-turn/);
  assert.match(row, /winner=A/);
  assert.match(row, /elo_a_before=1200/);
  assert.match(row, /elo_b_after=1184/);
});

test('toMatchRow throws on non-object input', () => {
  assert.throws(() => toMatchRow(null), TypeError);
});

// =================== runTournament — full smoke + invariants ===================

function makeHypotheses(n) {
  return Array.from({ length: n }, (_, i) => ({ pid: `hyp-${String(i).padStart(4, '0')}` }));
}

test('runTournament: 10 hypotheses × 5 rounds — all have elo, sorted DESC, history non-empty', () => {
  const hypotheses = makeHypotheses(10);
  const { hypotheses: ranked, matchHistory } = runTournament({
    hypotheses,
    rounds: 5,
  });
  assert.equal(ranked.length, 10);
  for (const h of ranked) {
    assert.ok(typeof h.elo === 'number' && Number.isFinite(h.elo), `pid ${h.pid} missing finite elo`);
  }
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].elo >= ranked[i].elo, `not sorted DESC at index ${i}`);
  }
  assert.ok(matchHistory.length > 0, 'matchHistory must be non-empty');
  // Each round can pair at most floor(10/2)=5 unique matches; 5 rounds × 5 matches max.
  assert.ok(matchHistory.length <= 25, `match count ${matchHistory.length} suspiciously large`);

  // Zero-sum invariant across all matches: sum of Elo changes is ~0.
  const totalDelta = matchHistory.reduce((s, m) => s + (m.eloAAfter - m.eloABefore) + (m.eloBAfter - m.eloBBefore), 0);
  assert.ok(Math.abs(totalDelta) < 1e-6, `tournament should be zero-sum (got ${totalDelta})`);
});

test('runTournament: top-ranked hypothesis after many rounds wins more than bottom-ranked', () => {
  const hypotheses = makeHypotheses(8);
  const { hypotheses: ranked, matchHistory } = runTournament({
    hypotheses,
    rounds: 12,
  });
  const top = ranked[0].pid;
  const bottom = ranked[ranked.length - 1].pid;
  const winsFor = (pid) => matchHistory.filter((m) => (m.hypA === pid && m.winner === 'A') || (m.hypB === pid && m.winner === 'B')).length;
  const topWins = winsFor(top);
  const bottomWins = winsFor(bottom);
  assert.ok(topWins > bottomWins, `top (${top}) wins ${topWins} must exceed bottom (${bottom}) wins ${bottomWins}`);
  assert.ok(ranked[0].elo > ranked[ranked.length - 1].elo, 'top Elo must exceed bottom Elo');
});

test('runTournament: proximity-driven matchmaking honored in round 0', () => {
  const hypotheses = makeHypotheses(6);
  // Force pair (hyp-0000, hyp-0005) — these would NOT be adjacent in Elo-desc
  // walk (all tie at 1200, so insertion order would pair 0-1, 2-3, 4-5).
  const proximityPairs = [[hypotheses[0].pid, hypotheses[5].pid]];
  const { matchHistory } = runTournament({
    hypotheses,
    proximityPairsOrUndefined: proximityPairs,
    rounds: 1,
  });
  const round0 = matchHistory.filter((m) => m.round === 0);
  const proximityMatch = round0.find(
    (m) => (m.hypA === hypotheses[0].pid && m.hypB === hypotheses[5].pid)
        || (m.hypA === hypotheses[5].pid && m.hypB === hypotheses[0].pid)
  );
  assert.ok(proximityMatch, `proximity pair (0,5) must appear in round 0 (got ${round0.map(m => `${m.hypA}-${m.hypB}`).join(', ')})`);
  assert.equal(proximityMatch.source, 'proximity', 'proximity-sourced match must be flagged');
});

test('runTournament: multi-turn triggered when any side >= threshold', () => {
  const hypotheses = [
    { pid: 'hyp-elite-1', elo: 1500 }, // above default threshold 1400
    { pid: 'hyp-elite-2', elo: 1500 },
    { pid: 'hyp-low-1' },
    { pid: 'hyp-low-2' },
  ];
  const { matchHistory } = runTournament({ hypotheses, rounds: 3 });
  const multiTurn = matchHistory.filter((m) => m.mode === 'multi-turn');
  const singleTurn = matchHistory.filter((m) => m.mode === 'single-turn');
  assert.ok(multiTurn.length > 0, 'at least one match should be multi-turn for elite Elos');
  // Multi-turn match must involve at least one elite.
  for (const m of multiTurn) {
    const involvesElite = [m.hypA, m.hypB].some((p) => p === 'hyp-elite-1' || p === 'hyp-elite-2');
    assert.ok(involvesElite, `multi-turn match ${m.hypA} vs ${m.hypB} must involve an elite`);
  }
  // Pure low-vs-low matches must remain single-turn.
  for (const m of singleTurn) {
    const bothLow = !['hyp-elite-1', 'hyp-elite-2'].includes(m.hypA) && !['hyp-elite-1', 'hyp-elite-2'].includes(m.hypB);
    if (bothLow) {
      assert.equal(m.mode, 'single-turn');
    }
  }
});

test('runTournament: emitted match objects round-trip through toMatchRow', () => {
  const { matchHistory } = runTournament({ hypotheses: makeHypotheses(4), rounds: 2 });
  for (const m of matchHistory) {
    const row = toMatchRow(m);
    assert.match(row, /^MATCH\|/);
    assert.ok(!row.includes('{'));
  }
});

test('runTournament: rejects array of length < 2', () => {
  assert.throws(() => runTournament({ hypotheses: [{ pid: 'solo' }], rounds: 1 }), RangeError);
});

test('runTournament: respects custom compareFn (live-judge swap-in)', () => {
  // Inject a judge that always picks A — top of the round always wins.
  const hypotheses = makeHypotheses(4);
  const { hypotheses: ranked, matchHistory } = runTournament({
    hypotheses,
    rounds: 3,
    compareFn: () => ({ winner: 'A', reason: 'forced-A' }),
  });
  for (const m of matchHistory) {
    assert.equal(m.winner, 'A');
    assert.equal(m.reason, 'forced-A');
    assert.ok(m.eloAAfter > m.eloABefore, 'A wins -> A Elo increases');
    assert.ok(m.eloBAfter < m.eloBBefore, 'A wins -> B Elo decreases');
  }
  assert.equal(ranked.length, 4);
});

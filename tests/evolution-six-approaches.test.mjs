// Evolution agent — six refinement approaches per Google AI Co-Scientist (§3.3.5).
// Tests enforce the CRITICAL CANON: parents are NEVER mutated.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  enhanceByGrounding,
  improveCoherence,
  inspireFromTopRanked,
  combineHypotheses,
  simplifyHypothesis,
  outOfBoxThinking,
  runAllEvolutionApproaches,
  toEvolutionRow,
  sha16,
} from '../src/evolution-six-approaches.mjs';

// --- fixtures --------------------------------------------------------------

function makeParent(overrides = {}) {
  return {
    pid: 'aaaaaaaaaaaaaaaa',
    text: 'Hypothesis: kinase K inhibits pathway P via binding site B.',
    score: 0.83,
    rank: 1,
    ...overrides,
  };
}

function makeTopRanked() {
  return [
    { pid: 'bbbbbbbbbbbbbbbb', text: 'kinase K route', score: 0.91 },
    { pid: 'cccccccccccccccc', text: 'allosteric inhibition route', score: 0.88 },
    { pid: 'dddddddddddddddd', text: 'covalent warhead route', score: 0.85 },
  ];
}

function snapshot(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// --- 1. enhanceByGrounding -------------------------------------------------

describe('enhanceByGrounding', () => {
  test('returns NEW hypothesis with different pid from parent', () => {
    const parent = makeParent();
    const child = enhanceByGrounding(parent, { weaknessAnnotation: 'no in-vivo evidence' });
    assert.notStrictEqual(child.pid, parent.pid);
    assert.match(child.pid, /^[0-9a-f]{16}$/);
  });

  test('preserves derivedFrom linkage to parent.pid', () => {
    const parent = makeParent();
    const child = enhanceByGrounding(parent, { weaknessAnnotation: 'weak data' });
    assert.strictEqual(child.derivedFrom, parent.pid);
  });

  test('derivationMethod === "enhance-grounding"', () => {
    const parent = makeParent();
    const child = enhanceByGrounding(parent, { weaknessAnnotation: 'X' });
    assert.strictEqual(child.derivationMethod, 'enhance-grounding');
  });

  test('text contains parent text and grounding annotation', () => {
    const parent = makeParent({ text: 'foo' });
    const child = enhanceByGrounding(parent, { weaknessAnnotation: 'bar' });
    assert.ok(child.text.includes('foo'));
    assert.ok(child.text.includes('bar'));
    assert.ok(child.text.includes('GROUNDED'));
  });

  test('throws when weaknessAnnotation missing', () => {
    assert.throws(() => enhanceByGrounding(makeParent(), {}), TypeError);
  });

  test('CANON: parent unchanged after call', () => {
    const parent = makeParent();
    const snap = snapshot(parent);
    enhanceByGrounding(parent, { weaknessAnnotation: 'mutation attempt' });
    assert.deepStrictEqual(parent, snap);
  });
});

// --- 2. improveCoherence ---------------------------------------------------

describe('improveCoherence', () => {
  test('returns NEW hypothesis with different pid', () => {
    const parent = makeParent();
    const child = improveCoherence(parent);
    assert.notStrictEqual(child.pid, parent.pid);
  });

  test('preserves derivedFrom + method', () => {
    const parent = makeParent();
    const child = improveCoherence(parent);
    assert.strictEqual(child.derivedFrom, parent.pid);
    assert.strictEqual(child.derivationMethod, 'coherence');
  });

  test('text wraps parent text with COHERENT-VARIANT', () => {
    const parent = makeParent({ text: 'baseline' });
    const child = improveCoherence(parent);
    assert.strictEqual(child.text, 'COHERENT-VARIANT(baseline)');
  });

  test('CANON: parent unchanged after call', () => {
    const parent = makeParent();
    const snap = snapshot(parent);
    improveCoherence(parent);
    assert.deepStrictEqual(parent, snap);
  });
});

// --- 3. inspireFromTopRanked ----------------------------------------------

describe('inspireFromTopRanked', () => {
  test('returns NEW hypothesis with different pid', () => {
    const parent = makeParent();
    const child = inspireFromTopRanked(parent);
    assert.notStrictEqual(child.pid, parent.pid);
  });

  test('preserves derivedFrom + method', () => {
    const parent = makeParent();
    const child = inspireFromTopRanked(parent);
    assert.strictEqual(child.derivedFrom, parent.pid);
    assert.strictEqual(child.derivationMethod, 'inspired');
  });

  test('text uses INSPIRED-BY wrapper', () => {
    const parent = makeParent({ text: 'core' });
    const child = inspireFromTopRanked(parent);
    assert.strictEqual(child.text, 'INSPIRED-BY(core)');
  });

  test('CANON: parent unchanged after call', () => {
    const parent = makeParent();
    const snap = snapshot(parent);
    inspireFromTopRanked(parent);
    assert.deepStrictEqual(parent, snap);
  });
});

// --- 4. combineHypotheses --------------------------------------------------

describe('combineHypotheses', () => {
  test('returns NEW hypothesis with method "combination"', () => {
    const parents = makeTopRanked();
    const child = combineHypotheses(parents);
    assert.strictEqual(child.derivationMethod, 'combination');
    assert.match(child.pid, /^[0-9a-f]{16}$/);
  });

  test('derivedFrom contains ALL parent pids, comma-separated', () => {
    const parents = makeTopRanked();
    const child = combineHypotheses(parents);
    const expected = parents.map((p) => p.pid).join(',');
    assert.strictEqual(child.derivedFrom, expected);
    for (const p of parents) assert.ok(child.derivedFrom.includes(p.pid));
  });

  test('child pid differs from every parent pid', () => {
    const parents = makeTopRanked();
    const child = combineHypotheses(parents);
    for (const p of parents) assert.notStrictEqual(child.pid, p.pid);
  });

  test('text contains all parent texts joined with " + "', () => {
    const parents = makeTopRanked();
    const child = combineHypotheses(parents);
    for (const p of parents) assert.ok(child.text.includes(p.text));
    assert.ok(child.text.startsWith('COMBINED('));
  });

  test('throws when fewer than 2 parents', () => {
    assert.throws(() => combineHypotheses([makeParent()]), TypeError);
    assert.throws(() => combineHypotheses([]), TypeError);
    assert.throws(() => combineHypotheses(null), TypeError);
  });

  test('CANON: all parents unchanged after call', () => {
    const parents = makeTopRanked();
    const snaps = parents.map(snapshot);
    combineHypotheses(parents);
    parents.forEach((p, i) => assert.deepStrictEqual(p, snaps[i]));
  });
});

// --- 5. simplifyHypothesis -------------------------------------------------

describe('simplifyHypothesis', () => {
  test('returns NEW hypothesis with method "simplification"', () => {
    const parent = makeParent();
    const child = simplifyHypothesis(parent);
    assert.strictEqual(child.derivationMethod, 'simplification');
    assert.notStrictEqual(child.pid, parent.pid);
  });

  test('text is shorter than or equal to parent text', () => {
    const longParent = makeParent({
      text: 'A '.repeat(200) + 'very long hypothesis with many qualifying clauses and footnotes.',
    });
    const child = simplifyHypothesis(longParent);
    assert.ok(
      child.text.length <= longParent.text.length + 'SIMPLE()'.length,
      `child.text.length ${child.text.length} should be <= parent + wrapper`
    );
    // For a truly long parent, the SIMPLE(slice(0,50)) wrapper must be shorter
    // than the original (50 + 8 = 58 chars vs original >> 58).
    assert.ok(
      child.text.length < longParent.text.length,
      `long parent: child ${child.text.length} should be < parent ${longParent.text.length}`
    );
  });

  test('short-parent edge case still wraps correctly', () => {
    const shortParent = makeParent({ text: 'hi' });
    const child = simplifyHypothesis(shortParent);
    assert.strictEqual(child.text, 'SIMPLE(hi)');
  });

  test('CANON: parent unchanged after call (including long-text parent)', () => {
    const parent = makeParent({ text: 'X'.repeat(500) });
    const snap = snapshot(parent);
    simplifyHypothesis(parent);
    assert.deepStrictEqual(parent, snap);
  });
});

// --- 6. outOfBoxThinking --------------------------------------------------

describe('outOfBoxThinking', () => {
  test('returns NEW hypothesis with method "out-of-box"', () => {
    const parent = makeParent();
    const child = outOfBoxThinking(parent, { divergenceSeed: 'quasar' });
    assert.strictEqual(child.derivationMethod, 'out-of-box');
    assert.notStrictEqual(child.pid, parent.pid);
  });

  test('different seeds → different text', () => {
    const parent = makeParent();
    const a = outOfBoxThinking(parent, { divergenceSeed: 'alpha' });
    const b = outOfBoxThinking(parent, { divergenceSeed: 'beta' });
    assert.notStrictEqual(a.text, b.text);
    assert.notStrictEqual(a.pid, b.pid);
    assert.ok(a.text.includes('alpha'));
    assert.ok(b.text.includes('beta'));
  });

  test('seed integer is accepted', () => {
    const parent = makeParent();
    const child = outOfBoxThinking(parent, { divergenceSeed: 42 });
    assert.ok(child.text.includes('seed=42'));
  });

  test('throws when divergenceSeed missing', () => {
    assert.throws(() => outOfBoxThinking(makeParent(), {}), TypeError);
    assert.throws(() => outOfBoxThinking(makeParent()), TypeError);
  });

  test('CANON: parent unchanged after call', () => {
    const parent = makeParent();
    const snap = snapshot(parent);
    outOfBoxThinking(parent, { divergenceSeed: 'mutation-attempt' });
    assert.deepStrictEqual(parent, snap);
  });
});

// --- runAllEvolutionApproaches --------------------------------------------

describe('runAllEvolutionApproaches', () => {
  test('returns array of exactly 6 new hypotheses', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked, weakness: 'lacks dose data' });
    assert.strictEqual(out.length, 6);
  });

  test('exposes one hypothesis per derivationMethod (all six tags present)', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked });
    const methods = out.map((h) => h.derivationMethod).sort();
    assert.deepStrictEqual(methods, [
      'coherence',
      'combination',
      'enhance-grounding',
      'inspired',
      'out-of-box',
      'simplification',
    ]);
  });

  test('all 6 outputs have UNIQUE pids in one call', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked });
    const pids = out.map((h) => h.pid);
    assert.strictEqual(new Set(pids).size, 6, `pids not unique: ${pids.join(', ')}`);
  });

  test('every output pid differs from parent pid', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked });
    for (const h of out) assert.notStrictEqual(h.pid, parent.pid);
  });

  test('default weakness is "generic"', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked });
    const enhanced = out.find((h) => h.derivationMethod === 'enhance-grounding');
    assert.ok(enhanced.text.includes('generic'));
  });

  test('combination output uses topRanked array as parents', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const out = runAllEvolutionApproaches({ parent, topRanked });
    const combined = out.find((h) => h.derivationMethod === 'combination');
    const expected = topRanked.map((p) => p.pid).join(',');
    assert.strictEqual(combined.derivedFrom, expected);
  });

  test('CANON: parent AND all topRanked entries unchanged after call', () => {
    const parent = makeParent();
    const topRanked = makeTopRanked();
    const parentSnap = snapshot(parent);
    const topSnaps = topRanked.map(snapshot);
    runAllEvolutionApproaches({ parent, topRanked, weakness: 'mutation attempt' });
    assert.deepStrictEqual(parent, parentSnap);
    topRanked.forEach((p, i) => assert.deepStrictEqual(p, topSnaps[i]));
  });

  test('throws when topRanked has < 2 entries', () => {
    assert.throws(
      () => runAllEvolutionApproaches({ parent: makeParent(), topRanked: [makeParent()] }),
      TypeError
    );
  });
});

// --- toEvolutionRow --------------------------------------------------------

describe('toEvolutionRow', () => {
  test('returns HBPv1 pipe-row (no JSON braces)', () => {
    const parent = makeParent();
    const child = improveCoherence(parent);
    const row = toEvolutionRow(child);
    assert.strictEqual(typeof row, 'string');
    assert.ok(!row.includes('{'), `row contains "{" (JSON leak): ${row}`);
    assert.ok(!row.includes('}'), `row contains "}" (JSON leak): ${row}`);
    assert.ok(row.startsWith('EVOLVED|'), `row missing EVOLVED prefix: ${row}`);
  });

  test('row carries pid, method, parent, text_sha16 in pipe form', () => {
    const parent = makeParent();
    const child = enhanceByGrounding(parent, { weaknessAnnotation: 'no in-vivo' });
    const row = toEvolutionRow(child);
    assert.ok(row.includes(`pid=${child.pid}`));
    assert.ok(row.includes('method=enhance-grounding'));
    assert.ok(row.includes(`parent=${parent.pid}`));
    assert.match(row, /\|text_sha16=[0-9a-f]{16}$/);
  });

  test('text_sha16 matches sha16(child.text)', () => {
    const parent = makeParent();
    const child = inspireFromTopRanked(parent);
    const row = toEvolutionRow(child);
    const expected = sha16(child.text);
    assert.ok(row.endsWith(`text_sha16=${expected}`));
  });

  test('combination row carries comma-separated parent pids', () => {
    const parents = makeTopRanked();
    const child = combineHypotheses(parents);
    const row = toEvolutionRow(child);
    const joined = parents.map((p) => p.pid).join(',');
    assert.ok(row.includes(`parent=${joined}`));
  });

  test('throws when hypothesis missing required fields', () => {
    assert.throws(() => toEvolutionRow(null), TypeError);
    assert.throws(() => toEvolutionRow({}), TypeError);
    assert.throws(
      () => toEvolutionRow({ pid: 'x', derivationMethod: 'm', derivedFrom: 'p' }),
      TypeError
    );
  });
});

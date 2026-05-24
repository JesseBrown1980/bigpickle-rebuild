// Benchmark harness. Not run by `npm test`; run via `npm run bench`.
// Measures per-module throughput so the spec's 63K msg/sec target can be
// honestly evaluated.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { mintPID } from '../../src/pid-minter.mjs';
import { writeHBP } from '../../src/hbp-emitter.mjs';
import { Hookwall } from '../../src/hookwall.mjs';
import { PortRouter } from '../../src/port-router.mjs';
import { PIDChainRevolver } from '../../src/pid-chain-revolver.mjs';
import { hilbertDecode } from '../../src/hilbert.mjs';

function bench(name, iters, fn) {
  // warm-up
  for (let i = 0; i < Math.min(iters, 1000); i++) fn(i);
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn(i);
  const t1 = performance.now();
  const ms = t1 - t0;
  const opsPerSec = (iters / (ms / 1000));
  return { name, iters, ms: ms.toFixed(2), opsPerSec: Math.round(opsPerSec) };
}

const results = [];

results.push(bench('mintPID tuple-form', 200_000, (i) =>
  mintPID({ actor: i % 256, device: 'bench', lane: 'memory', prime: 7 })
));

results.push(bench('mintPID index-form', 200_000, (i) =>
  mintPID({ index: i })
));

results.push(bench('hilbertDecode 2D bits=4', 500_000, (i) =>
  hilbertDecode(i % 256, { dimensions: 2, bits: 4 })
));

const hw = new Hookwall();
const envelope = { type: 'bench', tupleTag: ['a', 'b'], payload: 'p' };
results.push(bench('Hookwall.pass', 500_000, () => hw.pass(envelope)));

const router = new PortRouter();
for (let i = 0; i < 1000; i++) router.register(`50001.b.${i}`, () => i);
results.push(bench('PortRouter.route (depth 3, 1K siblings)', 500_000, (i) =>
  router.route(`50001.b.${i % 1000}`)
));

const rev = new PIDChainRevolver({ anchor: 'bench-anchor' });
results.push(bench('PIDChainRevolver.next', 200_000, () => rev.next()));

// writeHBP includes 4 disk writes per call — much slower
const dir = mkdtempSync(join(tmpdir(), 'bench-'));
try {
  results.push(bench('writeHBP (4-sidecar disk I/O)', 1_000, (i) =>
    writeHBP(join(dir, `e-${i}`), envelope)
  ));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('');
console.log('| module                                       | iters    |        ms |      ops/sec |');
console.log('|----------------------------------------------|----------|-----------|--------------|');
for (const r of results) {
  console.log(
    `| ${r.name.padEnd(44)} | ${String(r.iters).padStart(8)} | ${String(r.ms).padStart(9)} | ${String(r.opsPerSec).padStart(12)} |`
  );
}
console.log('');
console.log('Canonical target (per Foundation v1): 63 000 msg/sec single-host CPU-bound ceiling.');
console.log('See C:/asolaria-foundation-v1/02-PORT-NAMESPACE-CANON.md');

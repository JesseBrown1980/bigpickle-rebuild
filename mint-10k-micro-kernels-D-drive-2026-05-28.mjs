#!/usr/bin/env node
// Mint 10,000 micro-kernel descriptors on D drive.
// Per operator 2026-05-28T17:42Z: "we have asolaria OS on Metal and We can make 10K micro kernels and kernels"
// Aligned with Asolaria-OS kernel canon at C:/asolaria-acer/federation-remake-1024/kernel/core/ (Rust no_std).
//
// Each micro-kernel = independent execution descriptor:
//   - PID anchor (Brown-Hilbert prime)
//   - Beat range scope
//   - Lane set scope (7 lanes post-LYMPHATIC)
//   - Result HBP target path
//
// LAZY: minimal disk writes; one tiny HBP per micro-kernel. 10K files = ~1MB total.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { primeAt } from './src/primes.mjs';
import { LANE_CYCLE } from './src/pid-chain-revolver.mjs';
import { BEATS_PER_WAVE, WAVE_COUNT } from './src/deep-wave-decompose.mjs';

const MK_COUNT = parseInt(process.argv[2] || '10000', 10);
const SUBSTRATE_ROOT = 'D:/asolaria-micro-kernels-v1';
mkdirSync(SUBSTRATE_ROOT, { recursive: true });

function sha16(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }
function ts() { return new Date().toISOString(); }

const startTs = Date.now();
console.log(`MINT-10K-MK-START|count=${MK_COUNT}|substrate=${SUBSTRATE_ROOT}|ts=${ts()}`);

// Single batch manifest (avoid 10K tiny files — 1 file with 10K rows is sufficient)
const manifestLines = [];
const manifestHeader = `MANIFEST|schema=ASOLARIA-MICRO-KERNEL-V1|count=${MK_COUNT}|substrate=${SUBSTRATE_ROOT}|ts=${ts()}|canon_anchor=Asolaria-OS-kernel-Rust-no_std-21-modules-208-tests-d82bb25`;
manifestLines.push(manifestHeader);

for (let i = 0; i < MK_COUNT; i++) {
  const prime = primeAt(i % 1000);
  const anchor = `MK-${String(i).padStart(5, '0')}-P${prime}`;
  const pid = sha16(`asolaria-micro-kernel-v1|mk=${i}|p=${prime}|anchor=${anchor}`);
  const row = [
    'MK',
    `idx=${i}`,
    `pid=${pid}`,
    `prime=${prime}`,
    `anchor=${anchor}`,
    `beat_range=0..${WAVE_COUNT * BEATS_PER_WAVE}`,
    `lanes=${LANE_CYCLE.length}`,
    `result_path=${SUBSTRATE_ROOT}/results/mk-${String(i).padStart(5, '0')}.hbp`,
    `status=MINTED`,
  ].join('|');
  manifestLines.push(row);
}
manifestLines.push(`MANIFEST-FOOTER|endTs=${ts()}|sha16=${sha16('footer')}`);

const manifestPath = resolve(SUBSTRATE_ROOT, 'manifest.hbp');
writeFileSync(manifestPath, manifestLines.join('\n') + '\n');
const sha = createHash('sha256').update(manifestLines.join('\n') + '\n').digest('hex');
writeFileSync(manifestPath + '.sha256', sha + '  manifest.hbp\n');

// Pre-create results directory so worker writes don't race
mkdirSync(resolve(SUBSTRATE_ROOT, 'results'), { recursive: true });

const ms = Date.now() - startTs;
console.log(`MINT-10K-MK-DONE|count=${MK_COUNT}|wallClock_ms=${ms}|manifest_sha=${sha.slice(0, 16)}|manifest_bytes=${(manifestLines.join('\n') + '\n').length}|results_dir=${SUBSTRATE_ROOT}/results`);

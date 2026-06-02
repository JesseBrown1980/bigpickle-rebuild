// Ported patterns from obra/superpowers (read-only research clone at D:/external-research/superpowers).
// Per operator 2026-05-29 "clone → diff → advise; tests possible: unit, integration, latency, comparison".
//
// Three highest-leverage patterns ported as pure JS gates so they compose with our LAW-1M-1E200 + HBPv1 canon:
//   1. verificationGate         — superpowers/verification-before-completion "Gate Function"
//   2. systematicDebugCheck     — superpowers/systematic-debugging 4-phase root-cause
//   3. tddIronLawCheck          — superpowers/test-driven-development "Iron Law"
//
// NOT INSTALLED as plugin. Patterns ported manually to preserve LAW sovereignty.
// See D:/external-research/superpowers-diff/ADVICE-2026-05-29.md for full diff.

import { createHash } from 'node:crypto';
import { statSync, existsSync, readFileSync } from 'node:fs';

function sha16(s) { return createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function pipeRow(...p) { return p.join('|'); }

// =================== PORT 1: VERIFICATION GATE ===================
// Source: superpowers/skills/verification-before-completion/SKILL.md
// Iron Law: "If you haven't run the verification command in this message, you cannot claim it passes."
//
// Gate accepts only when evidence is FRESH (timestamp within current turn) and command output is provided.
// Stale or missing evidence → reject with reason. Composes with HBPv1 .ing audit-trace via outputHash field.

export function verificationGate({ claim, evidence, turnStartMs, nowMs = Date.now() }) {
  if (typeof claim !== 'string' || claim.length === 0) {
    throw new TypeError('verificationGate: claim required');
  }
  if (!evidence || typeof evidence !== 'object') {
    return {
      accepted: false,
      reason: 'NO_EVIDENCE',
      verdict_row: pipeRow('VERIFICATION-GATE', `claim_sha16=${sha16(claim)}`, 'accepted=false', 'reason=NO_EVIDENCE'),
    };
  }
  if (typeof evidence.command !== 'string' || evidence.command.length === 0) {
    return {
      accepted: false,
      reason: 'NO_COMMAND',
      verdict_row: pipeRow('VERIFICATION-GATE', `claim_sha16=${sha16(claim)}`, 'accepted=false', 'reason=NO_COMMAND'),
    };
  }
  if (typeof evidence.output !== 'string') {
    return {
      accepted: false,
      reason: 'NO_OUTPUT',
      verdict_row: pipeRow('VERIFICATION-GATE', `claim_sha16=${sha16(claim)}`, 'accepted=false', 'reason=NO_OUTPUT'),
    };
  }
  if (!Number.isFinite(evidence.timestampMs)) {
    return {
      accepted: false,
      reason: 'NO_TIMESTAMP',
      verdict_row: pipeRow('VERIFICATION-GATE', `claim_sha16=${sha16(claim)}`, 'accepted=false', 'reason=NO_TIMESTAMP'),
    };
  }
  if (Number.isFinite(turnStartMs) && evidence.timestampMs < turnStartMs) {
    return {
      accepted: false,
      reason: 'STALE_EVIDENCE',
      detail: `evidence ts ${evidence.timestampMs} < turn start ${turnStartMs}`,
      verdict_row: pipeRow('VERIFICATION-GATE', `claim_sha16=${sha16(claim)}`, 'accepted=false', 'reason=STALE_EVIDENCE'),
    };
  }
  const outputHash = sha16(evidence.output);
  return {
    accepted: true,
    reason: 'FRESH_EVIDENCE',
    outputHash,
    verdict_row: pipeRow(
      'VERIFICATION-GATE',
      `claim_sha16=${sha16(claim)}`,
      'accepted=true',
      `cmd_sha16=${sha16(evidence.command)}`,
      `output_sha16=${outputHash}`,
      `evidence_age_ms=${nowMs - evidence.timestampMs}`,
    ),
  };
}

// =================== PORT 2: SYSTEMATIC DEBUG 4-PHASE ===================
// Source: superpowers/skills/systematic-debugging/SKILL.md
// Iron Law: "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"
//
// Returns the gate status. Phase 3 (fix) is rejected unless Phase 1 (root cause) is populated AND
// Phase 4 (regression test) is planned. Composes with our honest-gap canon.

export const DEBUG_PHASES = Object.freeze({
  ROOT_CAUSE: 'phase1_root_cause',
  REPRO: 'phase2_minimal_repro',
  FIX: 'phase3_targeted_fix',
  REGRESSION_TEST: 'phase4_regression_test',
});

export function systematicDebugCheck({ phase1, phase2, phase3, phase4 }) {
  const status = {
    phases_complete: [],
    phases_missing: [],
    ready_to_fix: false,
    reason: '',
  };
  if (phase1 && typeof phase1.rootCause === 'string' && phase1.rootCause.length > 0) {
    status.phases_complete.push(DEBUG_PHASES.ROOT_CAUSE);
  } else {
    status.phases_missing.push(DEBUG_PHASES.ROOT_CAUSE);
  }
  if (phase2 && typeof phase2.minReproSteps === 'string' && phase2.minReproSteps.length > 0) {
    status.phases_complete.push(DEBUG_PHASES.REPRO);
  } else {
    status.phases_missing.push(DEBUG_PHASES.REPRO);
  }
  if (phase4 && typeof phase4.regressionTestPlan === 'string' && phase4.regressionTestPlan.length > 0) {
    status.phases_complete.push(DEBUG_PHASES.REGRESSION_TEST);
  } else {
    status.phases_missing.push(DEBUG_PHASES.REGRESSION_TEST);
  }
  // FIX is only ready when 1+2+4 are done (TDD: test before fix).
  const fixReady = status.phases_missing.length === 0;
  if (phase3 && phase3.appliedFix && !fixReady) {
    status.ready_to_fix = false;
    status.reason = `IRON_LAW_VIOLATION_fix_applied_before_phases_${status.phases_missing.join('_')}`;
  } else if (fixReady) {
    status.ready_to_fix = true;
    status.reason = 'ALL_PHASES_COMPLETE';
    if (phase3 && phase3.appliedFix) {
      status.phases_complete.push(DEBUG_PHASES.FIX);
    }
  } else {
    status.ready_to_fix = false;
    status.reason = `WAITING_FOR_PHASES_${status.phases_missing.join('_')}`;
  }
  status.verdict_row = pipeRow(
    'SYSTEMATIC-DEBUG',
    `phases_complete=${status.phases_complete.length}`,
    `phases_missing=${status.phases_missing.length}`,
    `ready_to_fix=${status.ready_to_fix}`,
    `reason=${status.reason}`,
  );
  return status;
}

// =================== PORT 3: TDD IRON LAW ===================
// Source: superpowers/skills/test-driven-development/SKILL.md
// Iron Law: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
//
// Checks: test file exists, references the src module by import or by name, was created BEFORE src module
// (proxy: test mtime <= src mtime within tolerance for fs noise). Composes with our HBPv1 audit-trace
// by emitting a verdict_row that includes both file shas.

export function tddIronLawCheck({ srcPath, testPath, importToleranceMs = 5000 }) {
  if (typeof srcPath !== 'string' || !existsSync(srcPath)) {
    return {
      passed: false,
      reason: 'SRC_NOT_FOUND',
      verdict_row: pipeRow('TDD-IRON-LAW', `src=${srcPath || ''}`, 'passed=false', 'reason=SRC_NOT_FOUND'),
    };
  }
  if (typeof testPath !== 'string' || !existsSync(testPath)) {
    return {
      passed: false,
      reason: 'TEST_NOT_FOUND',
      verdict_row: pipeRow('TDD-IRON-LAW', `src=${srcPath}`, `test=${testPath || ''}`, 'passed=false', 'reason=TEST_NOT_FOUND'),
    };
  }
  const srcStat = statSync(srcPath);
  const testStat = statSync(testPath);
  const srcContent = readFileSync(srcPath, 'utf8');
  const testContent = readFileSync(testPath, 'utf8');
  // Reference check: test must import or name-mention the src module.
  const srcBaseName = srcPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const importedOrReferenced = testContent.includes(srcBaseName) || testContent.includes(srcPath);
  if (!importedOrReferenced) {
    return {
      passed: false,
      reason: 'TEST_DOES_NOT_REFERENCE_SRC',
      verdict_row: pipeRow('TDD-IRON-LAW', `src=${srcBaseName}`, 'passed=false', 'reason=TEST_DOES_NOT_REFERENCE_SRC'),
    };
  }
  // Time ordering check: test should be authored at/before src (test-first canon).
  // With tolerance for fs noise / batch commits.
  const testWrittenFirst = testStat.mtimeMs <= srcStat.mtimeMs + importToleranceMs;
  if (!testWrittenFirst) {
    return {
      passed: false,
      reason: 'SRC_OLDER_THAN_TEST_BY_GT_TOLERANCE',
      detail: `src_mtime=${srcStat.mtimeMs} test_mtime=${testStat.mtimeMs} delta_ms=${srcStat.mtimeMs - testStat.mtimeMs}`,
      verdict_row: pipeRow('TDD-IRON-LAW', `src=${srcBaseName}`, 'passed=false', 'reason=SRC_OLDER_THAN_TEST'),
    };
  }
  // Assertion count: test must have at least one assert call.
  const assertionCount = (testContent.match(/assert\.\w+/g) || []).length;
  if (assertionCount === 0) {
    return {
      passed: false,
      reason: 'TEST_HAS_NO_ASSERTIONS',
      verdict_row: pipeRow('TDD-IRON-LAW', `src=${srcBaseName}`, 'passed=false', 'reason=NO_ASSERTIONS'),
    };
  }
  return {
    passed: true,
    reason: 'IRON_LAW_HONORED',
    src_sha16: sha16(srcContent),
    test_sha16: sha16(testContent),
    assertion_count: assertionCount,
    verdict_row: pipeRow(
      'TDD-IRON-LAW',
      `src=${srcBaseName}`,
      'passed=true',
      `src_sha16=${sha16(srcContent)}`,
      `test_sha16=${sha16(testContent)}`,
      `assertions=${assertionCount}`,
    ),
  };
}

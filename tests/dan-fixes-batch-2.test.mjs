// Combined test suite for Dan-hookwall-modernization Batch 2 fixes:
// #2 hot-tuple-validator, #3 warm-expansion, #4 payload-redaction,
// #6 agent-class-check, #7 runtime-tool-gate.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateHotTuple, serializeHotTuple, newlineCount, HOT_TUPLE_FIELDS, STATUS as HT_STATUS } from '../src/hot-tuple-validator.mjs';
import { expandToWarm, collapseToHot, WARM_MAX_LINES, STATUS as WE_STATUS } from '../src/warm-expansion.mjs';
import { redactPayload, COLD_FIELDS, STATUS as PR_STATUS } from '../src/payload-redaction.mjs';
import { classifyAgent, isStormRisk, AGENT_CLASSES, STATUS as AC_STATUS } from '../src/agent-class-check.mjs';
import { gateRuntimeTool, TOOL_CLASSES, STATUS as RG_STATUS } from '../src/runtime-tool-gate.mjs';
import { AUTHORITY_LEVELS } from '../src/universal-route.mjs';

describe('Dan-fix-2: hot-tuple-validator', () => {
  test('valid 3-field tuple passes', () => {
    const r = validateHotTuple({ pid: 'BH.PID.001', row_hash: 'abc123', ts: 1_000_000_000_000 });
    assert.equal(r.ok, true);
    assert.equal(r.tuple.pid, 'BH.PID.001');
  });

  test('missing field fails', () => {
    const r = validateHotTuple({ pid: 'x', row_hash: 'y' });
    assert.equal(r.ok, false);
    assert.match(r.error, /3 fields/);
  });

  test('extra field fails (one_line discipline)', () => {
    const r = validateHotTuple({ pid: 'x', row_hash: 'y', ts: 1, extra: 'bloat' });
    assert.equal(r.ok, false);
  });

  test('serialized form is one line (zero newlines)', () => {
    const s = serializeHotTuple({ pid: 'BH.PID.001', row_hash: 'abc', ts: 12345 });
    assert.equal(newlineCount(s), 0);
    assert.match(s, /^HBPv1\|pid=/);
  });

  test('STATUS surface', () => {
    assert.equal(HT_STATUS.schema, 'hot-tuple-validator.v1');
    assert.deepEqual([...HT_STATUS.fields], ['pid', 'row_hash', 'ts']);
  });
});

describe('Dan-fix-3: warm-expansion', () => {
  test('expands hot tuple into bounded warm profile', () => {
    const r = expandToWarm({ pid: 'BH.PID.001', row_hash: 'h', ts: 1 }, ['line1', 'line2']);
    assert.equal(r.truncated, false);
    assert.equal(r.lineCount, 4); // header + 2 body + end-marker
    assert.match(r.lines[0], /^# warm-profile pid=BH.PID.001/);
  });

  test('truncates at WARM_MAX_LINES (35)', () => {
    const bigBody = Array.from({ length: 100 }, (_, i) => `line-${i}`);
    const r = expandToWarm({ pid: 'p', row_hash: 'h', ts: 1 }, bigBody);
    assert.equal(r.truncated, true);
    assert.equal(r.lineCount, WARM_MAX_LINES);
    assert.equal(r.elidedCount, 100 - (WARM_MAX_LINES - 2));
  });

  test('collapseToHot extracts tuple from warm header', () => {
    const r = expandToWarm({ pid: 'BH.X', row_hash: 'abc', ts: 7777 }, ['body']);
    const c = collapseToHot(r.lines);
    assert.equal(c.ok, true);
    assert.equal(c.tuple.pid, 'BH.X');
    assert.equal(c.tuple.ts, 7777);
  });

  test('STATUS surface', () => {
    assert.equal(WE_STATUS.schema, 'warm-expansion.v1');
    assert.equal(WE_STATUS.warm_max_lines, 35);
  });
});

describe('Dan-fix-4: payload-redaction', () => {
  test('strips cold fields by default (dev authority)', () => {
    const r = redactPayload({ pid: 'X', secret: 'shhh', rawBody: 'raw text', event: 'ok' });
    assert.equal(r.pid, 'X');
    assert.equal(r.event, 'ok');
    assert.equal(r.secret, undefined);
    assert.equal(r.rawBody, undefined);
    assert.deepEqual(r._redacted.sort(), ['rawBody', 'secret']);
    assert.equal(r._redactionAuthority, 'dev');
  });

  test('staging authority + allowAtStaging keeps specific cold field', () => {
    const r = redactPayload(
      { secret: 'still cold', transcript: 'kept' },
      AUTHORITY_LEVELS.STAGING,
      { allowAtStaging: ['transcript'] },
    );
    assert.equal(r.secret, undefined);
    assert.equal(r.transcript, 'kept');
    assert.deepEqual(r._redacted, ['secret']);
  });

  test('prod authority + allowAtStaging keeps cold field', () => {
    const r = redactPayload(
      { secret: 'prod' },
      AUTHORITY_LEVELS.PROD,
      { allowAtStaging: ['secret'] },
    );
    assert.equal(r.secret, 'prod');
  });

  test('null/undefined payload returned unchanged', () => {
    assert.equal(redactPayload(null), null);
    assert.equal(redactPayload(undefined), undefined);
  });

  test('STATUS surface', () => {
    assert.equal(PR_STATUS.schema, 'payload-redaction.v1');
    assert.ok(PR_STATUS.cold_fields.includes('secret'));
  });
});

describe('Dan-fix-6: agent-class-check', () => {
  test('default ctx = virtual_pointer_agent', () => {
    const r = classifyAgent();
    assert.equal(r.agentClass, AGENT_CLASSES.VIRTUAL_POINTER);
  });

  test('planned spawns without receipt = AMBIGUOUS + blocked (storm guard)', () => {
    const r = classifyAgent({ plannedOsSpawns: 5 });
    assert.equal(r.agentClass, AGENT_CLASSES.AMBIGUOUS);
    assert.match(r.blockedReason, /real_agent_storm_guard_RG_0.999/);
    assert.equal(isStormRisk({ plannedOsSpawns: 5 }), true);
  });

  test('planned spawns + receipt = REAL_HELPER (allowed)', () => {
    const r = classifyAgent({ plannedOsSpawns: 3, hasReceipt: true });
    assert.equal(r.agentClass, AGENT_CLASSES.REAL_HELPER);
    assert.equal(isStormRisk({ plannedOsSpawns: 3, hasReceipt: true }), false);
  });

  test('STATUS surface', () => {
    assert.equal(AC_STATUS.schema, 'agent-class-check.v1');
  });
});

describe('Dan-fix-7: runtime-tool-gate', () => {
  test('descriptor class always allowed', () => {
    const r = gateRuntimeTool('Read', TOOL_CLASSES.DESCRIPTOR, {});
    assert.equal(r.allowed, true);
  });

  test('runtime class without receipt = blocked', () => {
    const r = gateRuntimeTool('Edit', TOOL_CLASSES.RUNTIME, {});
    assert.equal(r.allowed, false);
    assert.match(r.blockedReason, /no_receipt/);
  });

  test('runtime class with receipt = allowed', () => {
    const r = gateRuntimeTool('Edit', TOOL_CLASSES.RUNTIME, { hasReceipt: true });
    assert.equal(r.allowed, true);
  });

  test('control class requires receipt + prod authority', () => {
    const noAuth = gateRuntimeTool('Kill', TOOL_CLASSES.CONTROL, { hasReceipt: true });
    assert.equal(noAuth.allowed, false);
    assert.match(noAuth.blockedReason, /authorityLevel_prod/);
    const withAuth = gateRuntimeTool('Kill', TOOL_CLASSES.CONTROL, { hasReceipt: true, authorityLevel: 'prod' });
    assert.equal(withAuth.allowed, true);
  });

  test('invalid toolClass rejected', () => {
    const r = gateRuntimeTool('X', 'rogue', {});
    assert.equal(r.allowed, false);
    assert.match(r.blockedReason, /unknown toolClass/);
  });

  test('empty toolName rejected', () => {
    const r = gateRuntimeTool('', TOOL_CLASSES.RUNTIME, { hasReceipt: true });
    assert.equal(r.allowed, false);
  });

  test('STATUS surface', () => {
    assert.equal(RG_STATUS.schema, 'runtime-tool-gate.v1');
  });
});

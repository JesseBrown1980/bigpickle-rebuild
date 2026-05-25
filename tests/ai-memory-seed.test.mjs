// Contract tests for scripts/ai-memory-seed.mjs.
// Locks in the liris-350-reject lesson: session_id MUST be top-level
// snake_case in the JSON body for any non-session-start event.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SEEDER = 'scripts/ai-memory-seed.mjs';
const MARKER = '.ai-memory.toml';

describe('ai-memory-seed — file presence', () => {
  test('seeder script exists', () => {
    assert.ok(fs.existsSync(SEEDER), `${SEEDER} missing`);
  });
  test('marker file exists at repo root', () => {
    assert.ok(fs.existsSync(MARKER), `${MARKER} missing`);
  });
  test('docs/ai-memory.md present', () => {
    assert.ok(fs.existsSync('docs/ai-memory.md'), 'docs/ai-memory.md missing');
  });
  test('docs/pending-backlog.md present', () => {
    assert.ok(fs.existsSync('docs/pending-backlog.md'), 'docs/pending-backlog.md missing');
  });
});

describe('ai-memory-seed — payload contract (liris-350-reject lesson)', () => {
  const src = fs.readFileSync(SEEDER, 'utf8');

  test('session_id is top-level snake_case in user-prompt POST', () => {
    // The sanitizer rejects user-prompt events without top-level session_id.
    // Liris's first seed sent 350 with session_id only in URL query → 350 rejects.
    assert.match(src, /session_id:\s*SESSION_ID/);
  });
  test('session_id is top-level in session-start POST', () => {
    assert.match(src, /postHook\('session-start',\s*\{[\s\S]*?session_id: SESSION_ID/);
  });
  test('session_id is top-level in session-end POST', () => {
    assert.match(src, /postHook\('session-end',\s*\{[\s\S]*?session_id: SESSION_ID/);
  });
  test('truncation cap exists (prevents 10MB body-limit hit)', () => {
    assert.match(src, /content\.length\s*>\s*8000/);
  });
  test('throttle exists (prevents 429 saturation)', () => {
    assert.match(src, /setTimeout.*20/);
  });
  test('bearer auth header set when token present', () => {
    assert.match(src, /Authorization.*Bearer.*TOKEN/);
  });
  test('refuses non-loopback without token', () => {
    assert.match(src, /127\.0\.0\.1[\s\S]*?AI_MEMORY_AUTH_TOKEN required/);
  });
});

describe('ai-memory marker — bilateral routing', () => {
  const toml = fs.readFileSync(MARKER, 'utf8');
  test('declares workspace + project', () => {
    assert.match(toml, /workspace\s*=\s*"default"/);
    assert.match(toml, /project\s*=\s*"bigpickle-rebuild"/);
  });
});

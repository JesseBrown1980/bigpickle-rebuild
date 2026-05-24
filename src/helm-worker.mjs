// Helm worker — pluggable backend for spawning the actual work-doing agent.
//
// Backends:
//   mock        : returns predictable output; used by tests + dry runs
//   claude-cli  : spawns `claude --print --output-format json <prompt>` (subscription
//                 auth required; env-gated real-integration test only)
//   http-proxy  : POSTs the prompt to a configured URL (future :4951 path)
//
// The worker is intentionally a small surface — the supervisor handles all
// canonical concerns (PID mint, tuple fill, hookwall, HBP emit, sidecar trinity,
// GNN edges, gate classification). The worker only runs the prompt.

import { spawn } from 'node:child_process';

const VALID_BACKENDS = new Set(['mock', 'claude-cli', 'http-proxy']);

export function createWorker(opts = {}) {
  const backend = opts.backend ?? 'mock';
  if (!VALID_BACKENDS.has(backend)) {
    throw new Error(`createWorker: unknown backend "${backend}"`);
  }
  return {
    backend,
    forceFail: opts.forceFail === true,
    claudeBin: opts.claudeBin ?? 'claude',
    httpUrl: opts.httpUrl ?? null,
    timeoutMs: opts.timeoutMs ?? 60_000,
  };
}

async function runMock(worker, job) {
  if (worker.forceFail || job.forceFail) {
    return {
      backend: 'mock',
      exitCode: 1,
      stdout: '',
      stderr: 'forced-fail by request',
      durationMs: 0,
    };
  }
  const stdout = JSON.stringify({
    backend: 'mock',
    echoed_prompt: String(job.prompt ?? ''),
    note: 'mock-output: supervisor flow is proven via this echo',
    ts: new Date().toISOString(),
  });
  return { backend: 'mock', exitCode: 0, stdout, stderr: '', durationMs: 0 };
}

function runClaudeCli(worker, job) {
  return new Promise((resolve) => {
    const args = ['--print', '--output-format', 'json'];
    const start = Date.now();
    const child = spawn(worker.claudeBin, args, {
      cwd: job.workdir || process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolve({
        backend: 'claude-cli',
        exitCode: 124,
        stdout,
        stderr: stderr + `\n[helm-worker] timeout after ${worker.timeoutMs}ms`,
        durationMs: Date.now() - start,
      });
    }, worker.timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        backend: 'claude-cli',
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - start,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        backend: 'claude-cli',
        exitCode: code ?? 0,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });

    try {
      child.stdin.write(String(job.prompt ?? ''));
      child.stdin.end();
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        backend: 'claude-cli',
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - start,
      });
    }
  });
}

async function runHttpProxy(worker, job) {
  if (!worker.httpUrl) {
    return {
      backend: 'http-proxy',
      exitCode: -1,
      stdout: '',
      stderr: 'http-proxy backend requires httpUrl',
      durationMs: 0,
    };
  }
  const start = Date.now();
  try {
    const res = await fetch(worker.httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: job.prompt }),
    });
    const body = await res.text();
    return {
      backend: 'http-proxy',
      exitCode: res.ok ? 0 : 1,
      stdout: body,
      stderr: res.ok ? '' : `HTTP ${res.status}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      backend: 'http-proxy',
      exitCode: -1,
      stdout: '',
      stderr: String(err && err.message ? err.message : err),
      durationMs: Date.now() - start,
    };
  }
}

export async function runJob(worker, job) {
  if (worker.backend === 'mock') return runMock(worker, job);
  if (worker.backend === 'claude-cli') return runClaudeCli(worker, job);
  if (worker.backend === 'http-proxy') return runHttpProxy(worker, job);
  throw new Error(`runJob: unhandled backend "${worker.backend}"`);
}

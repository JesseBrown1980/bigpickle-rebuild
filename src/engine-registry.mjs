// Engine registry. Loads helm-engines.json — a flat manifest of every engine
// the helm + spawned sub-agents may reach (local files, daemons, URLs).
//
// Spec: layer 7. The registry is fresh-read per resolve so changes show up
// instantly without restarting the supervisor.

import { readFileSync, existsSync } from 'node:fs';

function validateEntry(entry, idx) {
  if (!entry || typeof entry !== 'object') {
    throw new TypeError(`engine-registry: entry #${idx} is not an object`);
  }
  if (typeof entry.name !== 'string' || !entry.name) {
    throw new TypeError(`engine-registry: entry #${idx} missing name`);
  }
  if (entry.kind !== 'file' && entry.kind !== 'http') {
    throw new TypeError(
      `engine-registry: entry "${entry.name}" missing valid kind (file|http)`
    );
  }
  if (entry.kind === 'file' && typeof entry.path !== 'string') {
    throw new TypeError(`engine-registry: file entry "${entry.name}" missing path`);
  }
  if (entry.kind === 'http' && typeof entry.url !== 'string') {
    throw new TypeError(`engine-registry: http entry "${entry.name}" missing url`);
  }
}

export function loadEngineRegistry(jsonPath) {
  if (!existsSync(jsonPath)) {
    throw new Error(`engine-registry: file not found: ${jsonPath}`);
  }
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.engines)) {
    throw new TypeError('engine-registry: expected {"engines":[...]} shape');
  }
  parsed.engines.forEach(validateEntry);
  return { source: jsonPath, engines: parsed.engines };
}

export function resolveEngine(registry, name) {
  if (!registry || !Array.isArray(registry.engines)) return null;
  return registry.engines.find((e) => e.name === name) ?? null;
}

export function registryEntries(registry) {
  return registry?.engines ?? [];
}

export function engineExists(registry, name) {
  const e = resolveEngine(registry, name);
  if (!e) return false;
  if (e.kind === 'file') return existsSync(e.path);
  return typeof e.url === 'string' && e.url.length > 0;
}

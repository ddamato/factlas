/**
 * Pinned tool versions for the snapshot header (ADR §2.4 rule 4).
 *
 * The parsers and value libraries factlas uses can change their output across
 * versions (a Babel grammar update, a culori color-space tweak). Folding their
 * resolved versions into the snapshot header makes a tool upgrade a visible
 * determinism input: `cache_key` changes, so caches invalidate. These are
 * factlas's *own* dependencies — reading their `package.json` is not executing
 * repository code.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Dependencies whose version can affect parsing/normalization output, and thus
 * belongs in the header. Sorted for a stable, canonical header.
 */
export const TOOL_PACKAGES = [
  '@babel/parser',
  '@babel/traverse',
  '@babel/types',
  'culori',
  'fast-glob',
  'postcss',
  'postcss-value-parser',
] as const;

/** Read a resolved dependency's version, or `undefined` if not resolvable. */
function readVersion(name: string): string | undefined {
  // Fast path: many packages expose ./package.json via their exports map.
  try {
    const pkg = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8'));
    if (typeof pkg.version === 'string') return pkg.version;
  } catch {
    // Package restricts its exports map; fall through to the walk-up below.
  }
  // Fallback: resolve the entry, then find the nearest matching package.json.
  try {
    let dir = path.dirname(require.resolve(name));
    for (let i = 0; i < 12; i++) {
      try {
        const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.name === name && typeof pkg.version === 'string') return pkg.version;
      } catch {
        // No package.json at this level, or unreadable; keep ascending.
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Entry not resolvable in this environment.
  }
  return undefined;
}

/**
 * Resolve the versions of factlas's parsing/normalization dependencies, keyed by
 * package name. Deterministic given a committed lockfile; unresolvable packages
 * are omitted rather than guessed.
 */
export function toolVersions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of TOOL_PACKAGES) {
    const version = readVersion(name);
    if (version !== undefined) out[name] = version;
  }
  return out;
}

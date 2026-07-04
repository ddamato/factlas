/**
 * Deterministic file discovery + the snapshot header.
 *
 * Discovery is the front of the determinism spine: it finds candidate files with
 * `fast-glob`, hashes each file's bytes with sha256, emits repo-relative POSIX
 * paths, and sorts everything by a locale-independent comparator. It then folds
 * tool/normalizer/plugin versions and config-file hashes into a snapshot header
 * whose `cache_key` changes whenever any determinism input changes — so a config
 * or version bump invalidates caches.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { canonicalStringify, sha256Hex } from './canonical.js';
import { FACT_SCHEMA_VERSION, NORMALIZER_VERSION } from './version.js';

/** Default source globs: TS/TSX and CSS. */
export const DEFAULT_INCLUDE = ['**/*.{ts,tsx,css}'] as const;

/** Directories never scanned; keeps discovery fast and deterministic. */
export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/.factlas/**',
] as const;

/** A single discovered source file. */
export interface DiscoveredFile {
  /** Repo-relative, POSIX-normalized path (forward slashes). */
  path: string;
  /** Lowercase hex sha256 of the file's raw bytes. */
  hash: string;
  /** File size in bytes. */
  bytes: number;
}

/**
 * The snapshot header: a fingerprint of every determinism input for a run.
 * Two runs with an identical header must produce byte-identical facts.
 */
export interface SnapshotHeader {
  schema_v: string;
  normalizer_v: string;
  /** Pinned parser/tool versions, e.g. `{ "@babel/parser": "7.26.3" }`. */
  tool_versions: Record<string, string>;
  /** Registered plugin versions, e.g. `{ "@factlas/plugin-css": "0.1.0" }`. */
  plugin_versions: Record<string, string>;
  /** sha256 of relevant config files, keyed by repo-relative POSIX path. */
  config_hashes: Record<string, string>;
  file_count: number;
  /** sha256 over the sorted `[path, hash]` pairs of all discovered files. */
  files_digest: string;
  /** sha256 over the whole header (minus this field) — the run cache key. */
  cache_key: string;
}

/** Result of a discovery pass. */
export interface DiscoverResult {
  /** Absolute root the run was rooted at. */
  root: string;
  files: DiscoveredFile[];
  header: SnapshotHeader;
}

export interface DiscoverOptions {
  /** Repository root to scan. */
  root: string;
  /** Glob patterns to include (default {@link DEFAULT_INCLUDE}). */
  include?: readonly string[];
  /** Glob patterns to exclude (default {@link DEFAULT_EXCLUDE}). */
  exclude?: readonly string[];
  /**
   * Config files whose contents affect extraction (e.g. `tailwind.config.ts`,
   * `postcss.config.js`). Paths are resolved against `root`; each is hashed and
   * folded into the header. Missing files are ignored.
   */
  configFiles?: readonly string[];
  /** Pinned tool versions to fold into the header. */
  toolVersions?: Record<string, string>;
  /** Plugin versions to fold into the header. */
  pluginVersions?: Record<string, string>;
}

/** Locale-independent path comparison by UTF-16 code unit. */
function comparePaths(a: DiscoveredFile, b: DiscoveredFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/** Read a file's bytes and hash them; returns `null` if the file is absent. */
async function hashFile(absPath: string): Promise<{ hash: string; bytes: number } | null> {
  try {
    const buf = await readFile(absPath);
    return { hash: sha256Hex(buf), bytes: buf.byteLength };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Discover source files under `root`, hash them, and build the snapshot header.
 * Output is fully sorted and path-normalized, independent of filesystem order.
 */
export async function discover(options: DiscoverOptions): Promise<DiscoverResult> {
  const root = path.resolve(options.root);
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;

  // fast-glob returns POSIX-separated, cwd-relative paths when absolute:false.
  const matches = await fg([...include], {
    cwd: root,
    ignore: [...exclude],
    absolute: false,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    // Never trust glob resolution order; we sort below.
  });

  const files: DiscoveredFile[] = [];
  for (const rel of matches) {
    const hashed = await hashFile(path.join(root, rel));
    if (!hashed) continue;
    files.push({ path: rel, hash: hashed.hash, bytes: hashed.bytes });
  }
  files.sort(comparePaths);

  const header = await buildHeader(root, files, options);
  return { root, files, header };
}

/** Hash configured config files, keyed by repo-relative POSIX path. */
async function hashConfigFiles(
  root: string,
  configFiles: readonly string[],
): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  for (const rel of configFiles) {
    const abs = path.resolve(root, rel);
    const key = path.relative(root, abs).split(path.sep).join('/');
    const hashed = await hashFile(abs);
    if (hashed) entries.push([key, hashed.hash]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(entries);
}

/** Build the snapshot header and derive its cache key. */
export async function buildHeader(
  root: string,
  files: readonly DiscoveredFile[],
  options: Pick<DiscoverOptions, 'configFiles' | 'toolVersions' | 'pluginVersions'>,
): Promise<SnapshotHeader> {
  const filesDigest = sha256Hex(canonicalStringify(files.map((f) => [f.path, f.hash])));
  const configHashes = options.configFiles ? await hashConfigFiles(root, options.configFiles) : {};

  const base = {
    schema_v: FACT_SCHEMA_VERSION,
    normalizer_v: NORMALIZER_VERSION,
    tool_versions: options.toolVersions ?? {},
    plugin_versions: options.pluginVersions ?? {},
    config_hashes: configHashes,
    file_count: files.length,
    files_digest: filesDigest,
  };

  const cache_key = sha256Hex(canonicalStringify(base));
  return { ...base, cache_key };
}

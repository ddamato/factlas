/**
 * The `factlas` CLI, factored as a testable `run(argv, io)` function.
 *
 * `factlas extract [path]` discovers a repo, extracts + normalizes facts with the
 * default plugins, and prints a deterministic `{ snapshot_header, facts }` stream
 * as canonical JSON. Extraction only — no evaluation, gating, or store (those are
 * downstream concerns; see docs/DOWNSTREAM.md).
 */

import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  type PersistentFileCache,
  canonicalStringify,
  createDiskCache,
  extractRepo,
} from '@factlas/core';
import { coverageReport, formatCoverage } from './coverage.js';
import { defaultPlugins } from './plugins.js';

/** Where the incremental cache lives, relative to the scanned root. */
const CACHE_FILE = '.factlas/cache.json';

/** CLI version, read from package.json so it never drifts from the release. */
export const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

/** Injected I/O so `run` is testable without touching real stdio. */
export interface CliIO {
  cwd: string;
  out(text: string): void;
  err(text: string): void;
  writeFile(file: string, data: string): Promise<void>;
}

const USAGE = `factlas — deterministic design-system fact extraction

Usage:
  factlas extract [path] [options]

Extracts a normalized, content-addressed fact stream from a TypeScript/TSX + CSS
repository (static analysis only; never executes your code) and prints it as
canonical JSON. Extraction only — evaluation/gating is a downstream concern.

Arguments:
  path                   Directory to scan (default: current directory)

Options:
  -o, --out <file>       Write output to <file> instead of stdout
      --include <glob>   Glob to include (repeatable; default: **/*.{ts,tsx,css})
      --exclude <glob>   Glob to exclude (repeatable)
      --config <file>    Config file folded into the snapshot header (repeatable;
                         e.g. tailwind.config.ts) so a change invalidates caches
      --pretty           Pretty-print JSON (default: compact canonical JSON)
      --stats            Print a coverage summary (kinds/certainty/sources +
                         unknown-rate) to stderr
      --no-cache         Disable the incremental cache (.factlas/cache.json);
                         re-extract every file
  -h, --help             Show this help
  -v, --version          Show version

Output shape: { "snapshot_header": {...}, "facts": [...] }
`;

const OPTIONS = {
  out: { type: 'string', short: 'o' },
  config: { type: 'string', multiple: true },
  include: { type: 'string', multiple: true },
  exclude: { type: 'string', multiple: true },
  pretty: { type: 'boolean' },
  stats: { type: 'boolean' },
  'no-cache': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

/** Run the CLI. Returns a process exit code. */
export async function run(argv: string[], io: CliIO): Promise<number> {
  let values: Record<string, unknown>;
  let positionals: string[];
  try {
    const parsed = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    io.err(`factlas: ${message(err)}\n\n${USAGE}`);
    return 2;
  }

  if (values.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }

  const command = positionals[0];
  if (values.help || !command) {
    io.out(USAGE);
    return command || values.help ? 0 : 1;
  }
  if (command !== 'extract') {
    io.err(`factlas: unknown command '${command}'\n\n${USAGE}`);
    return 2;
  }

  const root = path.resolve(io.cwd, positionals[1] ?? '.');
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) {
      io.err(`factlas: not a directory: ${root}\n`);
      return 1;
    }
  } catch {
    io.err(`factlas: no such directory: ${root}\n`);
    return 1;
  }

  const useCache = !values['no-cache'];
  let cache: PersistentFileCache | undefined;
  if (useCache) {
    try {
      cache = await createDiskCache(path.join(root, CACHE_FILE));
    } catch {
      // A cache that won't load shouldn't fail the run; extract without it.
      cache = undefined;
    }
  }

  let result: Awaited<ReturnType<typeof extractRepo>>;
  try {
    result = await extractRepo({
      root,
      plugins: defaultPlugins,
      ...(cache ? { cache } : {}),
      ...(values.include ? { include: values.include as string[] } : {}),
      ...(values.exclude ? { exclude: values.exclude as string[] } : {}),
      ...(values.config ? { configFiles: values.config as string[] } : {}),
    });
  } catch (err) {
    io.err(`factlas: extraction failed: ${message(err)}\n`);
    return 1;
  }

  if (cache) {
    try {
      await cache.save();
    } catch {
      // Best-effort: a failed cache write must not fail an otherwise-good run.
    }
  }

  const output = { snapshot_header: result.header, facts: result.facts };
  const json = values.pretty ? JSON.stringify(output, null, 2) : canonicalStringify(output);

  if (values.out) {
    await io.writeFile(path.resolve(io.cwd, values.out as string), `${json}\n`);
  } else {
    io.out(`${json}\n`);
  }

  const report = coverageReport(result);
  const cacheNote = cache ? `, ${cache.hits} cached/${cache.hits + cache.misses}` : '';
  io.err(
    `factlas: ${report.facts} facts from ${report.files} files ` +
      `(${report.unresolved} dynamic/unknown, ${report.diagnostics} diagnostics${cacheNote})\n`,
  );
  if (values.stats) io.err(`\n${formatCoverage(report)}`);
  return 0;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

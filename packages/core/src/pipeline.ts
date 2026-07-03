/**
 * Repo-level orchestration (the programmatic "run on a repo" entry point).
 *
 * `extractRepo` ties the fact layer together: discover files (+ snapshot header),
 * extract raw observations with the given plugins, assemble them into normalized
 * facts, and return a single globally-sorted, deterministic stream. Plugins are
 * injected, so core keeps no dependency on any specific plugin (ADR §2.2).
 *
 * This does **not** read into a store, run policies, or gate anything — that is
 * a downstream concern (see docs/DOWNSTREAM.md).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assembleFacts } from './assemble.js';
import { sortFacts } from './assemble.js';
import { type DiscoverOptions, type SnapshotHeader, discover } from './discover.js';
import { extractFile } from './extract/extractFile.js';
import type { Fact } from './fact.js';
import { type DesignFactsPlugin, type Diagnostic, pluginVersions } from './plugin/types.js';
import { toolVersions } from './tools.js';

/** Options for {@link extractRepo}: discovery options plus the plugin set. */
export interface ExtractRepoOptions extends Omit<DiscoverOptions, 'pluginVersions'> {
  /** Plugins to run. Their versions are folded into the snapshot header. */
  plugins: readonly DesignFactsPlugin[];
}

/** The complete result of extracting a repository. */
export interface ExtractRepoResult {
  header: SnapshotHeader;
  /** Globally-sorted, normalized facts. */
  facts: Fact[];
  /** Non-fatal diagnostics (parse failures, unresolved values, plugin errors). */
  diagnostics: Diagnostic[];
}

/**
 * Extract a normalized, deterministic fact stream from a repository.
 * Reads files statically; never executes repository code.
 */
export async function extractRepo(options: ExtractRepoOptions): Promise<ExtractRepoResult> {
  const { plugins, ...discoverOptions } = options;
  const { root, files, header } = await discover({
    ...discoverOptions,
    // Default the header's tool_versions to factlas's own resolved parser/
    // normalizer deps; an explicit caller-provided value still wins.
    toolVersions: discoverOptions.toolVersions ?? toolVersions(),
    pluginVersions: pluginVersions(plugins),
  });

  const facts: Fact[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const file of files) {
    const code = await readFile(path.join(root, file.path), 'utf8');
    const extracted = extractFile({ file: file.path, code, plugins });
    diagnostics.push(...extracted.diagnostics);
    facts.push(...assembleFacts(extracted));
  }

  return { header, facts: sortFacts(facts), diagnostics };
}

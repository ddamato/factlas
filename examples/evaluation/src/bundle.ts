/**
 * Policy bundle loading (DOWNSTREAM.md §3). A bundle is versioned *data*:
 * metadata plus, per rule, a `.sql` query that selects violation rows. Every
 * query returns the same columns — `fact_id, file, line, col, message` — which
 * is the contract the evaluator maps onto SARIF results.
 */

import { readFile } from 'node:fs/promises';

/** SARIF-aligned severity. `error` fails the CI gate; the rest are advisory. */
export type Level = 'error' | 'warning' | 'note';

/** One policy rule as authored in `bundle.json`. */
export interface Rule {
  id: string;
  title: string;
  sql: string;
  level: Level;
  /** How the rule treats unresolved facts; documentation for this demo. */
  certaintyPolicy: string;
  help: string;
}

/** The bundle as authored. */
export interface Bundle {
  name: string;
  version: string;
  description: string;
  rules: Rule[];
}

/** A rule with its SQL query text loaded. */
export interface LoadedRule extends Rule {
  query: string;
}

/** A bundle with every rule's SQL loaded and ready to run. */
export interface LoadedBundle extends Omit<Bundle, 'rules'> {
  rules: LoadedRule[];
}

const DEFAULT_DIR = new URL('../policies/', import.meta.url);

/** Load `bundle.json` and each rule's `.sql` file from a policies directory. */
export async function loadBundle(dir: URL = DEFAULT_DIR): Promise<LoadedBundle> {
  const bundle = JSON.parse(await readFile(new URL('bundle.json', dir), 'utf8')) as Bundle;
  const rules: LoadedRule[] = [];
  for (const rule of bundle.rules) {
    const query = await readFile(new URL(rule.sql, dir), 'utf8');
    rules.push({ ...rule, query });
  }
  return { ...bundle, rules };
}

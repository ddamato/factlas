/**
 * Policy loading (DOWNSTREAM.md §3). The policy set lives in
 * `design-system/policy.json`, right next to the guidelines and tokens it is
 * compiled from. Each policy is small enough to read inline: a one-line `sql`
 * that selects violation rows, and a `message` template whose `{placeholders}`
 * are filled from the matched row's columns (see `evaluate.ts`).
 */

import { readFile } from 'node:fs/promises';

/** SARIF-aligned severity. `error` fails the CI gate; the rest are advisory. */
export type Level = 'error' | 'warning' | 'note';

/** One policy — the machine-checkable form of a single guideline section. */
export interface Policy {
  id: string;
  /** The guideline this policy enforces, e.g. `guidelines.md#color`. */
  guideline: string;
  level: Level;
  /** SQL selecting violation rows; zero rows = pass. Must select `SELECT *`. */
  sql: string;
  /** Message template; `{column}` placeholders are filled from the matched row. */
  message: string;
  help: string;
}

/** A versioned set of policies (the "policy bundle" of DOWNSTREAM.md §3). */
export interface PolicySet {
  name: string;
  version: string;
  description: string;
  policies: Policy[];
}

const DEFAULT_URL = new URL('../design-system/policy.json', import.meta.url);

/** Load the policy set from `design-system/policy.json`. */
export async function loadPolicies(url: URL = DEFAULT_URL): Promise<PolicySet> {
  return JSON.parse(await readFile(url, 'utf8')) as PolicySet;
}

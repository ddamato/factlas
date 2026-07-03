/**
 * Evaluation (DOWNSTREAM.md §3–4). Load facts into the store, attach the
 * normalized allowed-sets, run each policy's SQL, and collect the violation
 * rows. Deterministic: rows are ordered by the SQL and then re-sorted, so the
 * same facts + bundle always yield the same result (and thus the same SARIF).
 */

import type { Fact } from '@factlas/core';
import { type Level, type LoadedBundle, loadBundle } from './bundle.js';
import { loadAllowedSets } from './reference.js';
import { createFactStore } from './store.js';

/** One policy violation, tied back to the fact that produced it. */
export interface Violation {
  ruleId: string;
  level: Level;
  message: string;
  factId: string;
  file: string;
  line: number;
  col: number;
}

/** The outcome of evaluating a fact stream against a bundle. */
export interface EvalResult {
  bundle: LoadedBundle;
  violations: Violation[];
  counts: Record<Level, number>;
  /** True when there are no `error`-level violations (the CI gate passes). */
  ok: boolean;
}

export interface EvaluateOptions {
  /** Policies directory; defaults to this package's bundled `policies/`. */
  bundleDir?: URL;
}

/** Evaluate a fact stream against the policy bundle. */
export async function evaluate(
  facts: readonly Fact[],
  options: EvaluateOptions = {},
): Promise<EvalResult> {
  const db = await createFactStore(facts);
  await loadAllowedSets(db);
  const bundle = await loadBundle(options.bundleDir);

  const violations: Violation[] = [];
  for (const rule of bundle.rules) {
    for (const result of db.exec(rule.query)) {
      const at = columnLookup(result.columns, rule.id);
      for (const row of result.values) {
        violations.push({
          ruleId: rule.id,
          level: rule.level,
          message: String(row[at('message')]),
          factId: String(row[at('fact_id')]),
          file: String(row[at('file')]),
          line: Number(row[at('line')]),
          col: Number(row[at('col')]),
        });
      }
    }
  }
  db.close();

  violations.sort(compareViolations);
  const counts = tally(violations);
  return { bundle, violations, counts, ok: counts.error === 0 };
}

/** Resolve a result column to its index, failing loudly on the bundle contract. */
function columnLookup(columns: string[], ruleId: string): (name: string) => number {
  return (name) => {
    const i = columns.indexOf(name);
    if (i < 0) throw new Error(`policy "${ruleId}" must select a "${name}" column`);
    return i;
  };
}

/** Stable ordering: file, then position, then rule, then fact id. */
function compareViolations(a: Violation, b: Violation): number {
  return (
    cmp(a.file, b.file) ||
    a.line - b.line ||
    a.col - b.col ||
    cmp(a.ruleId, b.ruleId) ||
    cmp(a.factId, b.factId)
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function tally(violations: readonly Violation[]): Record<Level, number> {
  const counts: Record<Level, number> = { error: 0, warning: 0, note: 0 };
  for (const v of violations) counts[v.level] += 1;
  return counts;
}

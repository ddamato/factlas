/**
 * Evaluation (DOWNSTREAM.md §3–4). Run each policy's SQL against the fact
 * database, turn the matched rows into violations (rendering each policy's
 * `message` template from the row's columns), and collect them. Deterministic:
 * the same facts + policies always yield the same violations, SARIF, and scores.
 */

import type { Fact } from '@factlas/core';
import { buildDatabase } from './database.js';
import { type Level, loadPolicies, type Policy, type PolicySet } from './policy.js';
import type { FactDb } from './store.js';

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

/** The outcome of evaluating a fact database against a policy set. */
export interface EvalResult {
  policySet: PolicySet;
  violations: Violation[];
  counts: Record<Level, number>;
  /** True when there are no `error`-level violations (the CI gate passes). */
  ok: boolean;
}

/** Fill a `message` template's `{column}` placeholders from a result row. */
function render(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = row[key];
    return value == null ? '' : String(value);
  });
}

/** Run one policy's SQL and turn its rows into violations. */
export function runPolicy(db: FactDb, policy: Policy): Violation[] {
  const rows = db.prepare(policy.sql).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    ruleId: policy.id,
    level: policy.level,
    message: render(policy.message, row),
    factId: String(row.fact_id),
    file: String(row.file),
    line: Number(row.line),
    col: Number(row.col),
  }));
}

/** Run every policy against the database. */
export function runPolicies(db: FactDb, policySet: PolicySet): EvalResult {
  const violations = policySet.policies.flatMap((policy) => runPolicy(db, policy));
  violations.sort(compareViolations);
  const counts = tally(violations);
  return { policySet, violations, counts, ok: counts.error === 0 };
}

export interface EvaluateOptions {
  /** Policy-set file URL; defaults to this package's `design-system/policy.json`. */
  policyUrl?: URL;
}

/** Convenience: build an in-memory DB from facts and evaluate it. */
export async function evaluate(
  facts: readonly Fact[],
  options: EvaluateOptions = {},
): Promise<EvalResult> {
  const db = buildDatabase(facts);
  try {
    return runPolicies(db, await loadPolicies(options.policyUrl));
  } finally {
    db.close();
  }
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

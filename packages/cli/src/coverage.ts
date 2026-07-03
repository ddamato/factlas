/**
 * Coverage metrics over an extracted fact stream (ADR §4).
 *
 * Aggregation is a *consumer* concern, not part of the fact layer — so it lives
 * here in the CLI. `coverageReport` tallies facts by kind/certainty/source and
 * diagnostics by reason, and surfaces the `unknown`/`dynamic` rate: the headline
 * signal for "how much did extraction have to give up on this repo?" A rising
 * rate is the early warning that a plugin started degrading to honest-`unknown`
 * on patterns it used to handle.
 */

import type { ExtractRepoResult } from '@factlas/core';

/** A structured coverage summary for a single extraction run. */
export interface CoverageReport {
  files: number;
  facts: number;
  byKind: Record<string, number>;
  byCertainty: Record<string, number>;
  bySource: Record<string, number>;
  /** Facts with `dynamic` or `unknown` certainty. */
  unresolved: number;
  /** `unresolved / facts` in `[0, 1]` (0 when there are no facts). */
  unresolvedRate: number;
  diagnostics: number;
  diagnosticsByReason: Record<string, number>;
}

/** Compute a {@link CoverageReport} from an extraction result. */
export function coverageReport(result: ExtractRepoResult): CoverageReport {
  const byKind: Record<string, number> = {};
  const byCertainty: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let unresolved = 0;

  for (const fact of result.facts) {
    tally(byKind, fact.kind);
    tally(byCertainty, fact.certainty);
    tally(bySource, fact.source);
    if (fact.certainty === 'dynamic' || fact.certainty === 'unknown') unresolved++;
  }

  const diagnosticsByReason: Record<string, number> = {};
  for (const diagnostic of result.diagnostics) tally(diagnosticsByReason, diagnostic.reason);

  const facts = result.facts.length;
  return {
    files: result.header.file_count,
    facts,
    byKind,
    byCertainty,
    bySource,
    unresolved,
    unresolvedRate: facts === 0 ? 0 : unresolved / facts,
    diagnostics: result.diagnostics.length,
    diagnosticsByReason,
  };
}

/** Render a coverage report as human-readable text (for `--stats` on stderr). */
export function formatCoverage(report: CoverageReport): string {
  const pct = (report.unresolvedRate * 100).toFixed(1);
  const lines = [
    `files ${report.files}  facts ${report.facts}  unresolved ${report.unresolved} (${pct}%)  diagnostics ${report.diagnostics}`,
    section('by kind', report.byKind),
    section('by certainty', report.byCertainty),
    section('by source', report.bySource),
  ];
  if (report.diagnostics > 0)
    lines.push(section('diagnostics by reason', report.diagnosticsByReason));
  return `${lines.join('\n')}\n`;
}

function tally(into: Record<string, number>, key: string): void {
  into[key] = (into[key] ?? 0) + 1;
}

function section(title: string, counts: Record<string, number>): string {
  const rows = Object.entries(counts)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, count]) => `  ${key.padEnd(22)} ${count}`);
  return [`${title}:`, ...rows].join('\n');
}

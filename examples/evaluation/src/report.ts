/**
 * Human-readable summary for the terminal. The gate decision lives in
 * `EvalResult.ok`; this is just the operator-facing view of it.
 */

import type { EvalResult } from './evaluate.js';

const MARK: Record<string, string> = { error: 'x', warning: '!', note: 'i' };

/** Format an evaluation result as a compact per-policy summary. */
export function formatReport(result: EvalResult): string {
  const byPolicy = new Map<string, number>();
  for (const v of result.violations) byPolicy.set(v.ruleId, (byPolicy.get(v.ruleId) ?? 0) + 1);

  const lines = [`factlas evaluation — ${result.policySet.name}@${result.policySet.version}`];
  for (const policy of result.policySet.policies) {
    const n = byPolicy.get(policy.id) ?? 0;
    const mark = MARK[policy.level] ?? '?';
    lines.push(`  [${mark}] ${policy.level.padEnd(7)} ${policy.id.padEnd(24)} ${n}`);
  }
  const { error, warning, note } = result.counts;
  const total = error + warning + note;
  lines.push(
    `  ${total} findings (${error} error, ${warning} warning, ${note} note) -> ${
      result.ok ? 'PASS' : 'FAIL'
    }`,
  );
  return lines.join('\n');
}

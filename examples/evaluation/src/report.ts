/**
 * Human-readable summary for the terminal. The gate decision lives in
 * `EvalResult.ok`; this is just the operator-facing view of it.
 */

import type { EvalResult } from './evaluate.js';

const MARK: Record<string, string> = { error: 'x', warning: '!', note: 'i' };

/** Format an evaluation result as a compact per-rule summary. */
export function formatReport(result: EvalResult): string {
  const byRule = new Map<string, number>();
  for (const v of result.violations) byRule.set(v.ruleId, (byRule.get(v.ruleId) ?? 0) + 1);

  const lines = [`factlas evaluation — ${result.bundle.name}@${result.bundle.version}`];
  for (const rule of result.bundle.rules) {
    const n = byRule.get(rule.id) ?? 0;
    lines.push(`  [${MARK[rule.level] ?? '?'}] ${rule.level.padEnd(7)} ${rule.id.padEnd(24)} ${n}`);
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

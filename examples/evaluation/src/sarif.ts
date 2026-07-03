/**
 * SARIF 2.1.0 output (DOWNSTREAM.md §4). Emit a Static Analysis Results
 * Interchange Format log so violations drop straight into GitHub code scanning
 * or any SARIF viewer. Types come from `@types/sarif` (the published spec types)
 * — the log itself is plain JSON we construct.
 *
 * Coordinate note: SARIF regions are 1-based for both line and column; factlas
 * `loc.col` is 0-based (Babel/PostCSS convention), so we emit `col + 1`.
 */

import type { Log, ReportingDescriptor, Result } from 'sarif';
import type { EvalResult } from './evaluate.js';

const INFO_URI = 'https://github.com/ddamato/factlas';

/** Build a SARIF log from an evaluation result. */
export function toSarif(result: EvalResult): Log {
  const rules: ReportingDescriptor[] = result.bundle.rules.map((rule) => ({
    id: rule.id,
    name: rule.title,
    shortDescription: { text: rule.title },
    helpUri: INFO_URI,
    help: { text: rule.help },
    defaultConfiguration: { level: rule.level },
  }));

  const ruleIndex = new Map(result.bundle.rules.map((rule, i) => [rule.id, i]));

  const results: Result[] = result.violations.map((v) => ({
    ruleId: v.ruleId,
    ruleIndex: ruleIndex.get(v.ruleId) ?? 0,
    level: v.level,
    message: { text: v.message },
    partialFingerprints: { factId: v.factId },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: v.file },
          region: { startLine: v.line, startColumn: v.col + 1 },
        },
      },
    ],
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'factlas-example-eval',
            informationUri: INFO_URI,
            version: result.bundle.version,
            rules,
          },
        },
        results,
      },
    ],
  };
}

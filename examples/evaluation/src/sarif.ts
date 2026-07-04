/**
 * The SARIF reporter for `design-system/policy.json` (DOWNSTREAM.md §4) — the
 * machine-facing counterpart to the evalite scorecard. It runs every policy and
 * serializes each matched row as a SARIF 2.1.0 result, so violations drop
 * straight into GitHub code scanning or any SARIF viewer.
 *
 * The shared setup — extract, store, load policies, run a policy — lives in
 * `harness.ts`; this file only turns rows into findings. Valid SARIF is built
 * with `node-sarif-builder` rather than hand-assembled.
 *
 * Coordinate note: SARIF regions are 1-based for line and column; factlas
 * `loc.col` is 0-based (Babel/PostCSS convention), so we emit `col + 1`.
 *
 * Run it:  npm run sarif -w @factlas/example-evaluation            (to stdout)
 *          npm run sarif -w @factlas/example-evaluation results.sarif  (to file)
 */

import { writeFile } from 'node:fs/promises';
import {
  SarifBuilder,
  SarifResultBuilder,
  SarifRuleBuilder,
  SarifRunBuilder,
} from 'node-sarif-builder';
import { prepare, type Row, runPolicy } from './harness.js';

const INFO_URI = 'https://github.com/ddamato/factlas';

/** Fill a `message` template's `{column}` placeholders from a matched row. */
function render(template: string, row: Row): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = row[key];
    return value == null ? '' : String(value);
  });
}

const { db, policySet } = await prepare();

const sarifRun = new SarifRunBuilder().initSimple({
  toolDriverName: 'factlas-example-eval',
  toolDriverVersion: policySet.version,
  url: INFO_URI,
});

for (const policy of policySet.policies) {
  // One rule per policy, carrying its guideline provenance and default severity.
  const rule = new SarifRuleBuilder().initSimple({
    ruleId: policy.id,
    shortDescriptionText: policy.help,
    helpUri: INFO_URI,
  });
  rule.rule.defaultConfiguration = { level: policy.level };
  rule.rule.properties = { guideline: policy.guideline };
  sarifRun.addRule(rule);

  // One result per matched row — the row *is* the violation.
  for (const row of runPolicy(db, policy)) {
    const result = new SarifResultBuilder().initSimple({
      ruleId: policy.id,
      level: policy.level,
      messageText: render(policy.message, row),
      fileUri: String(row.file),
      startLine: Number(row.line),
      startColumn: Number(row.col) + 1,
      endLine: Number(row.endLine),
      endColumn: Number(row.endCol) + 1,
    });
    // Content-addressed fact id → stable fingerprint for code-scanning dedup.
    result.result.partialFingerprints = { factId: String(row.fact_id) };
    sarifRun.addResult(result);
  }
}

db.close();

const sarifBuilder = new SarifBuilder();
sarifBuilder.addRun(sarifRun);
const json = sarifBuilder.buildSarifJsonString({ indent: true });

const outPath = process.argv[2];
if (outPath) {
  await writeFile(outPath, `${json}\n`, 'utf8');
  process.stderr.write(`factlas: SARIF written to ${outPath}\n`);
} else {
  process.stdout.write(`${json}\n`);
}

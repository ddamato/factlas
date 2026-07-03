import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACT_KINDS, extractRepo } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import { coverageReport } from './coverage.js';
import { defaultPlugins } from './plugins.js';

// The full example app at the repo root — the regression target.
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples/app');

async function coverage() {
  return coverageReport(await extractRepo({ root: APP, plugins: defaultPlugins }));
}

describe('coverageReport', () => {
  it('tallies kind/certainty/source and computes the unresolved rate', () => {
    const report = coverageReport({
      header: { file_count: 1 } as never,
      diagnostics: [{ reason: 'x' }, { reason: 'x' }] as never,
      facts: [
        { kind: 'css.declaration', certainty: 'literal', source: 'plain-css' },
        { kind: 'css.declaration', certainty: 'dynamic', source: 'inline' },
        { kind: 'import', certainty: 'unknown', source: 'babel-jsx' },
      ] as never,
    });
    expect(report.facts).toBe(3);
    expect(report.byKind['css.declaration']).toBe(2);
    expect(report.unresolved).toBe(2); // dynamic + unknown
    expect(report.unresolvedRate).toBeCloseTo(2 / 3);
    expect(report.diagnosticsByReason.x).toBe(2);
  });

  it('handles an empty result without dividing by zero', () => {
    const report = coverageReport({
      header: { file_count: 0 } as never,
      facts: [],
      diagnostics: [],
    });
    expect(report.unresolvedRate).toBe(0);
  });
});

// Regression guard: extraction quality over the example app must not silently
// degrade (a plugin that starts dropping to `unknown` would trip these).
describe('coverage over examples/app', () => {
  it('extracts every one of the six fact kinds', async () => {
    const report = await coverage();
    for (const kind of FACT_KINDS) {
      expect(report.byKind[kind] ?? 0, `expected ${kind} facts`).toBeGreaterThan(0);
    }
  });

  it('keeps the unresolved rate within budget', async () => {
    const report = await coverage();
    expect(report.facts).toBeGreaterThan(50);
    expect(report.unresolvedRate).toBeLessThanOrEqual(0.15);
  });
});

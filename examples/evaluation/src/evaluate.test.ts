import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Fact } from '@factlas/core';
import { extractRepo } from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import jsx from '@factlas/plugin-jsx';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDatabase } from './database.js';
import { evaluate, runPolicies, type Violation } from './evaluate.js';
import { loadPolicies } from './policy.js';
import { toSarif } from './sarif.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');
const PLUGINS = [jsx, cssPlugin, inlineStyle, styled, tailwind];

let facts: Fact[];
let tmp: string;

beforeAll(async () => {
  ({ facts } = await extractRepo({ root: APP, plugins: PLUGINS }));
  tmp = await mkdtemp(path.join(tmpdir(), 'factlas-eval-'));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const messagesFor = (violations: Violation[], ruleId: string) =>
  violations.filter((v) => v.ruleId === ruleId).map((v) => v.message);

describe('evaluate examples/app against the policy bundle', () => {
  it('fails the gate with the expected severity breakdown', async () => {
    const result = await evaluate(facts);
    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({ error: 9, warning: 11, note: 5 });
  });

  it('flags off-token colors but not values that match a normalized token', async () => {
    const { violations } = await evaluate(facts);
    const colors = messagesFor(violations, 'color-off-token').join('\n');
    expect(colors).toContain('#dddddd'); // App.tsx border-color
    expect(colors).toContain('#eeeeee'); // Badge inline background
    // BRAND (#3366FF) and danger (#E00) normalize to #3366ff / #ee0000 and are
    // NOT flagged — only possible because the allowed-set used the same normalizer.
    expect(colors).not.toContain('#3366ff');
    expect(colors).not.toContain('#ee0000');
  });

  it('flags off-scale lengths against the spacing tokens', async () => {
    const { violations } = await evaluate(facts);
    expect(messagesFor(violations, 'spacing-off-scale')).toHaveLength(3);
  });

  it('flags arbitrary Tailwind values', async () => {
    const { violations } = await evaluate(facts);
    const arb = messagesFor(violations, 'no-arbitrary-tailwind');
    expect(arb).toHaveLength(2);
    expect(arb.join('\n')).toContain('text-[#123456]');
    expect(arb.join('\n')).toContain('w-[13px]');
  });

  it('flags inline style declarations', async () => {
    const { violations } = await evaluate(facts);
    expect(messagesFor(violations, 'no-inline-style')).toHaveLength(6);
  });

  it('routes only unresolved facts to needs-review (never a literal)', async () => {
    const { violations } = await evaluate(facts);
    const review = violations.filter((v) => v.ruleId === 'needs-review');
    expect(review).toHaveLength(5);
    for (const v of review) expect(v.message).toMatch(/\((dynamic|unknown):/);
  });

  it("records each policy's guideline provenance", async () => {
    const policySet = await loadPolicies();
    for (const policy of policySet.policies) {
      expect(policy.guideline).toMatch(/^guidelines\.md#/);
    }
  });

  it('persists a real, re-queryable SQLite database on disk', async () => {
    const file = path.join(tmp, 'facts.db');
    const built = await buildDatabase(facts, { file });
    built.close();
    // Reopen independently: the file is a normal SQLite database.
    const reopened = (await import('better-sqlite3')).default(file, { readonly: true });
    const total = reopened.prepare('SELECT COUNT(*) AS c FROM facts').get() as { c: number };
    reopened.close();
    expect(total.c).toBe(facts.length);
  });

  it('emits a well-formed, deterministic SARIF 2.1.0 log', async () => {
    const db = await buildDatabase(facts);
    const result = runPolicies(db, await loadPolicies());
    db.close();
    const sarif = toSarif(result);
    expect(sarif.version).toBe('2.1.0');
    const run = sarif.runs[0];
    expect(run?.tool.driver.rules).toHaveLength(5);
    expect(run?.results).toHaveLength(result.violations.length);
    // SARIF columns are 1-based; factlas loc.col is 0-based.
    const region = run?.results?.[0]?.locations?.[0]?.physicalLocation?.region;
    expect(region?.startColumn).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(toSarif(runPolicies(await buildDatabase(facts), result.policySet)))).toBe(
      JSON.stringify(sarif),
    );
  });
});

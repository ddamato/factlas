import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRepo } from '@factlas/core';
import type { Fact } from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import jsx from '@factlas/plugin-jsx';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';
import { beforeAll, describe, expect, it } from 'vitest';
import { type Violation, evaluate } from './evaluate.js';
import { toSarif } from './sarif.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');
const PLUGINS = [jsx, cssPlugin, inlineStyle, styled, tailwind];

let facts: Fact[];

beforeAll(async () => {
  ({ facts } = await extractRepo({ root: APP, plugins: PLUGINS }));
});

const messagesFor = (violations: Violation[], ruleId: string) =>
  violations.filter((v) => v.ruleId === ruleId).map((v) => v.message);

describe('evaluate examples/app against the policy bundle', () => {
  it('fails the gate on off-token color errors', async () => {
    const result = await evaluate(facts);
    expect(result.ok).toBe(false);
    expect(result.counts.error).toBe(9);
    expect(result.counts).toEqual({ error: 9, warning: 8, note: 5 });
  });

  it('flags off-token colors but not values that match a normalized token', async () => {
    const { violations } = await evaluate(facts);
    const colors = messagesFor(violations, 'color-off-token').join('\n');
    // Off-token raw values are caught…
    expect(colors).toContain('#dddddd'); // App.tsx border-color
    expect(colors).toContain('#eeeeee'); // Badge inline background
    // …but BRAND (#3366FF token) and danger (#E00 token), normalized to #3366ff
    // and #ee0000, are NOT — this only works because the allowed-set was
    // normalized with the same @factlas/core normalizers the facts were.
    expect(colors).not.toContain('#3366ff');
    expect(colors).not.toContain('#ee0000');
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
    // Every needs-review finding cites a dynamic/unknown certainty, never literal.
    for (const v of review) expect(v.message).toMatch(/\((dynamic|unknown):/);
  });

  it('emits a well-formed SARIF 2.1.0 log', async () => {
    const result = await evaluate(facts);
    const sarif = toSarif(result);
    expect(sarif.version).toBe('2.1.0');
    const run = sarif.runs[0];
    expect(run?.tool.driver.rules).toHaveLength(4);
    expect(run?.results).toHaveLength(result.violations.length);
    const region = run?.results?.[0]?.locations?.[0]?.physicalLocation?.region;
    // SARIF columns are 1-based; factlas loc.col is 0-based.
    expect(region?.startColumn).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic: identical SARIF across two runs', async () => {
    const a = toSarif(await evaluate(facts));
    const b = toSarif(await evaluate(facts));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

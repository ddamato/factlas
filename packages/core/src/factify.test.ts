import { describe, expect, it } from 'vitest';
import type { FactDraft } from './factify.js';
import { computeFactId, factify } from './factify.js';
import { FACT_SCHEMA_VERSION } from './version.js';

const baseLoc = { line: 1, col: 0, endLine: 1, endCol: 10 };

function cssDeclarationDraft(norm: string | null, raw: string): FactDraft {
  return {
    kind: 'css.declaration',
    file: 'src/Button.css',
    loc: baseLoc,
    source: 'plain-css',
    producer_v: '@factlas/plugin-css@0.1.0',
    certainty: 'literal',
    subject: { property: 'color', selector: '.btn', media: null, owner_component: null },
    value: { raw, norm, type: 'color' },
  };
}

describe('computeFactId', () => {
  it('is deterministic: identical identity tuples yield identical ids', () => {
    const input = {
      kind: 'css.declaration' as const,
      file: 'src/Button.css',
      loc: baseLoc,
      subject: { property: 'color', selector: '.btn', media: null, owner_component: null },
      norm: '#ffffff',
    };
    // Re-order subject keys to prove key order does not affect the id.
    const reordered = {
      ...input,
      subject: { owner_component: null, media: null, selector: '.btn', property: 'color' },
    };
    expect(computeFactId(input)).toBe(computeFactId(reordered));
  });

  it('differs when the normalized value differs', () => {
    const common = {
      kind: 'css.declaration' as const,
      file: 'src/Button.css',
      loc: baseLoc,
      subject: { property: 'color', selector: '.btn', media: null, owner_component: null },
    };
    expect(computeFactId({ ...common, norm: '#ffffff' })).not.toBe(
      computeFactId({ ...common, norm: '#000000' }),
    );
  });

  it('differs when location differs', () => {
    const common = {
      kind: 'css.declaration' as const,
      file: 'src/Button.css',
      subject: { property: 'color', selector: '.btn', media: null, owner_component: null },
      norm: '#ffffff',
    };
    expect(computeFactId({ ...common, loc: baseLoc })).not.toBe(
      computeFactId({ ...common, loc: { ...baseLoc, line: 2 } }),
    );
  });

  it('is a 64-char lowercase hex sha256', () => {
    const id = computeFactId({
      kind: 'import',
      file: 'src/x.ts',
      loc: baseLoc,
      subject: { specifier: 'react', local: 'React', import_kind: 'default' },
      norm: 'react',
    });
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('factify', () => {
  it('collapses raw variants of the same normalized value to one fact_id', () => {
    const upper = factify(cssDeclarationDraft('#ffffff', '#FFF'));
    const lower = factify(cssDeclarationDraft('#ffffff', '#ffffff'));
    expect(upper.fact_id).toBe(lower.fact_id);
  });

  it('stamps the current schema version', () => {
    const fact = factify(cssDeclarationDraft('#ffffff', '#FFF'));
    expect(fact.schema_v).toBe(FACT_SCHEMA_VERSION);
  });

  it('handles value-less kinds (jsx.element) with norm=null', () => {
    const fact = factify({
      kind: 'jsx.element',
      file: 'src/Button.tsx',
      loc: baseLoc,
      source: 'babel-jsx',
      producer_v: '@factlas/plugin-css@0.1.0',
      certainty: 'literal',
      subject: { name: 'Button', imported_from: '@acme/ui', is_dom: false },
    });
    expect(fact.fact_id).toMatch(/^[0-9a-f]{64}$/);
    expect('value' in fact).toBe(false);
  });
});

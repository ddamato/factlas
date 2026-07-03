import { describe, expect, it } from 'vitest';
import { assembleFact, assembleFacts, sortFacts } from './assemble.js';
import type { ExtractFileResult } from './extract/extractFile.js';
import type { Observation } from './plugin/types.js';
import { FACT_SCHEMA_VERSION } from './version.js';

const loc = { line: 3, col: 2, endLine: 3, endCol: 20 };

function cssDecl(
  property: string,
  raw: string,
  source: Observation['source'] = 'plain-css',
): Observation {
  return {
    kind: 'css.declaration',
    loc,
    source,
    subject: { property, selector: '.btn', media: null, owner_component: null },
    value: { raw, type: 'color' },
  };
}

const PRODUCER = '@factlas/plugin-css@0.1.0';
const assemble = (observation: Observation) =>
  assembleFact({ file: 'src/Button.css', producer: PRODUCER, observation });

describe('assembleFact', () => {
  it('normalizes a literal color value and stamps envelope fields', () => {
    const fact = assemble(cssDecl('color', '#FFF'));
    expect(fact.kind).toBe('css.declaration');
    expect(fact.certainty).toBe('literal');
    expect(fact.schema_v).toBe(FACT_SCHEMA_VERSION);
    expect(fact.producer_v).toBe(PRODUCER);
    expect(fact.fact_id).toMatch(/^[0-9a-f]{64}$/);
    expect('value' in fact && fact.value).toEqual({ raw: '#FFF', norm: '#ffffff', type: 'color' });
  });

  it('canonicalizes the CSS property name in the subject', () => {
    const fact = assemble(cssDecl('backgroundColor', '#000', 'inline'));
    expect(fact.kind).toBe('css.declaration');
    if (fact.kind === 'css.declaration') {
      expect(fact.subject.property).toBe('background-color');
    }
  });

  it('collapses equivalent raw values to one fact_id (content-addressed)', () => {
    expect(assemble(cssDecl('color', '#FFF')).fact_id).toBe(
      assemble(cssDecl('color', '#ffffff')).fact_id,
    );
  });

  it('is deterministic across identical inputs', () => {
    expect(assemble(cssDecl('color', 'red')).fact_id).toBe(
      assemble(cssDecl('color', 'red')).fact_id,
    );
  });

  it('nulls the norm and adds a diagnostic for dynamic values', () => {
    const fact = assembleFact({
      file: 'src/Button.tsx',
      producer: '@test/x@1.0.0',
      observation: {
        kind: 'jsx.prop',
        loc,
        source: 'babel-jsx',
        subject: { component: 'Button', prop: 'variant', element_id: 'abc' },
        value: { raw: '{expr}', type: 'keyword', dynamic: true },
      },
    });
    expect(fact.certainty).toBe('dynamic');
    expect('value' in fact && fact.value?.norm).toBeNull();
    expect(fact.diagnostic).toBeTruthy();
  });

  it('degrades an unnormalizable literal to an honest unknown', () => {
    const fact = assemble(cssDecl('color', 'definitely-not-a-color'));
    expect(fact.certainty).toBe('unknown');
    expect('value' in fact && fact.value?.norm).toBeNull();
    expect(fact.diagnostic).toBe('unnormalizable-color');
  });

  it('handles value-less kinds (jsx.element)', () => {
    const fact = assembleFact({
      file: 'src/Button.tsx',
      producer: '@test/x@1.0.0',
      observation: {
        kind: 'jsx.element',
        loc,
        source: 'babel-jsx',
        subject: { name: 'Button', imported_from: '@acme/ui', is_dom: false },
      },
    });
    expect(fact.certainty).toBe('literal');
    expect('value' in fact).toBe(false);
    expect(fact.fact_id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('assembleFacts', () => {
  it('assembles and sorts facts deterministically by position', () => {
    const result: ExtractFileResult = {
      file: 'src/Button.css',
      diagnostics: [],
      observations: [
        {
          producer: PRODUCER,
          observation: {
            kind: 'css.declaration',
            loc: { line: 9, col: 0, endLine: 9, endCol: 5 },
            source: 'plain-css',
            subject: { property: 'color', selector: '.b', media: null, owner_component: null },
            value: { raw: 'red', type: 'color' },
          },
        },
        {
          producer: PRODUCER,
          observation: {
            kind: 'css.declaration',
            loc: { line: 2, col: 0, endLine: 2, endCol: 5 },
            source: 'plain-css',
            subject: { property: 'color', selector: '.a', media: null, owner_component: null },
            value: { raw: 'blue', type: 'color' },
          },
        },
      ],
    };
    const facts = assembleFacts(result);
    expect(facts.map((f) => f.loc.line)).toEqual([2, 9]);
  });
});

describe('sortFacts', () => {
  it('does not mutate the input array', () => {
    const facts = [assemble(cssDecl('color', 'red'))];
    const copy = [...facts];
    sortFacts(facts);
    expect(facts).toEqual(copy);
  });
});

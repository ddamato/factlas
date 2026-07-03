import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { Fact } from './fact.js';
import { factify } from './factify.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../schema/fact.schema.json');

async function loadValidator() {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

const loc = { line: 1, col: 0, endLine: 1, endCol: 10 };

const element = factify({
  kind: 'jsx.element',
  file: 'src/Button.tsx',
  loc,
  source: 'babel-jsx',
  producer_v: '@factlas/plugin-css@0.1.0',
  certainty: 'literal',
  subject: { name: 'Button', imported_from: '@acme/ui', is_dom: false },
});

const samples: Fact[] = [
  element,
  factify({
    kind: 'jsx.prop',
    file: 'src/Button.tsx',
    loc,
    source: 'babel-jsx',
    producer_v: '@factlas/plugin-css@0.1.0',
    certainty: 'literal',
    subject: { component: 'Button', prop: 'variant', element_id: element.fact_id },
    value: { raw: 'primary', norm: 'primary', type: 'keyword' },
  }),
  factify({
    kind: 'jsx.attribute',
    file: 'src/Button.tsx',
    loc,
    source: 'inline',
    producer_v: '@factlas/plugin-inline-style@0.1.0',
    certainty: 'literal',
    subject: { owner: 'Button', attribute: 'style', element_id: element.fact_id },
    value: { raw: '{color:"red"}', norm: 'color:#ff0000', type: 'string' },
  }),
  factify({
    kind: 'import',
    file: 'src/Button.tsx',
    loc,
    source: 'babel-jsx',
    producer_v: '@factlas/plugin-css@0.1.0',
    certainty: 'literal',
    subject: { specifier: '@acme/ui', local: 'Button', import_kind: 'named' },
    value: { raw: '@acme/ui', norm: '@acme/ui', type: 'module' },
  }),
  factify({
    kind: 'css.declaration',
    file: 'src/Button.css',
    loc,
    source: 'plain-css',
    producer_v: '@factlas/plugin-css@0.1.0',
    certainty: 'literal',
    subject: {
      property: 'color',
      selector: '.btn',
      media: null,
      owner_component: null,
      element_id: null,
    },
    value: { raw: '#FFF', norm: '#ffffff', type: 'color' },
  }),
  factify({
    kind: 'css.class',
    file: 'src/Button.tsx',
    loc,
    source: 'tailwind',
    producer_v: '@factlas/plugin-tailwind@0.1.0',
    certainty: 'literal',
    subject: { token: 'text-red-500', utility: 'text', is_arbitrary: false, element_id: null },
    value: { raw: 'text-red-500', norm: 'color:#ef4444', type: 'color' },
  }),
];

describe('fact.schema.json', () => {
  it('validates a sample fact of every kind', async () => {
    const validate = await loadValidator();
    for (const fact of samples) {
      const ok = validate(fact);
      expect(ok, `${fact.kind}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it('covers all six fact kinds in the samples', () => {
    expect(new Set(samples.map((f) => f.kind)).size).toBe(6);
  });

  it('rejects a fact with an unknown kind', async () => {
    const validate = await loadValidator();
    const bad = { ...element, kind: 'jsx.bogus' };
    expect(validate(bad)).toBe(false);
  });

  it('rejects a dynamic value with a non-null norm mismatch shape', async () => {
    const validate = await loadValidator();
    const bad = { ...samples[4], value: { raw: 'x', norm: 123, type: 'color' } };
    expect(validate(bad)).toBe(false);
  });

  it('keeps the schema $id stable (published contract)', async () => {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    expect(schema.$id).toBe('https://factlas.dev/schema/fact.schema.json');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { factColumns, factSchema } from '../scripts/generate.mjs';

// The committed schema artifacts are generated from the TypeScript types (the
// single source of truth). This regenerates them and fails if the committed files
// have drifted — i.e. someone changed the Fact types but not `npm run generate`.

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(here, '..', 'schema');
const read = (name) => JSON.parse(readFileSync(path.join(schemaDir, name), 'utf8'));

describe('generated schema artifacts stay in sync with the types', () => {
  it('schema/fact.schema.json matches `npm run generate`', () => {
    expect(read('fact.schema.json')).toEqual(factSchema());
  });

  it('schema/columns.json matches `npm run generate`', () => {
    expect(read('columns.json')).toEqual(factColumns());
  });
});

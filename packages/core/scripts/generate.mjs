/**
 * Generate the published, versioned artifacts from the TypeScript types — the
 * single source of truth is `src/fact.ts`:
 *
 *   schema/fact.schema.json  the JSON Schema for a Fact (mirrors the types)
 *   schema/columns.json      a flat, DB-agnostic column manifest for the common
 *                            (envelope + value) fields, so a consumer can generate
 *                            a table in any database from it (see DOWNSTREAM.md §1)
 *
 * Run `npm run generate` after changing the Fact types; a test regenerates and
 * fails if the committed files drift. Do not hand-edit the outputs.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, '..');
const SCHEMA_DIR = path.join(coreRoot, 'schema');

const SCHEMA_ID = 'https://factlas.dev/schema/fact.schema.json';
const META_2020 = 'https://json-schema.org/draft/2020-12/schema';

function generator() {
  return createGenerator({
    path: path.join(coreRoot, 'src', 'fact.ts'),
    tsconfig: path.join(coreRoot, 'tsconfig.json'),
    skipTypeCheck: true,
    additionalProperties: true,
  });
}

/** The Fact JSON Schema, normalized to this project's 2020-12 / `$defs` / `$id`. */
export function factSchema(gen = generator()) {
  const raw = gen.createSchema('Fact');
  // ts-json-schema-generator emits draft-07 `definitions` + `#/definitions/` refs.
  const renamed = JSON.parse(JSON.stringify(raw).replaceAll('#/definitions/', '#/$defs/'));
  return {
    $schema: META_2020,
    $id: SCHEMA_ID,
    title: 'Factlas Fact',
    description:
      'A single normalized, content-addressed design-system fact. Generated from ' +
      '@factlas/core src/fact.ts (do not edit by hand); gated by FACT_SCHEMA_VERSION.',
    $ref: renamed.$ref,
    $defs: renamed.definitions,
  };
}

/** Resolve a property schema to a base JSON type, following one `$ref` hop. */
function baseType(schema, defs) {
  if (!schema) return undefined;
  if (schema.$ref) return baseType(defs[schema.$ref.split('/').pop()], defs);
  const t = Array.isArray(schema.type) ? schema.type.find((x) => x !== 'null') : schema.type;
  return t;
}

/** DB-agnostic column type for a property schema. */
function columnType(schema, defs) {
  const t = baseType(schema, defs);
  if (t === 'number' || t === 'integer') return 'integer';
  if (t === 'boolean') return 'boolean';
  return 'text';
}

function isNullable(key, schema, required) {
  if (!required.includes(key)) return true;
  return Array.isArray(schema.type) && schema.type.includes('null');
}

/**
 * The flat column manifest for the common (envelope + value) fields. Each entry is
 * `{ name, path, type, nullable }`: the SQL-ish column name, the JSONPath into a
 * stored fact, a DB-agnostic type, and whether it can be null. Kind-specific
 * subject fields are intentionally excluded — they stay in the JSON.
 */
export function factColumns(gen = generator()) {
  const env = gen.createSchema('FactEnvelope').definitions;
  const val = gen.createSchema('FactValue').definitions;
  const columns = [];

  const push = (name, jsonPath, schema, defs, required) =>
    columns.push({
      name,
      path: jsonPath,
      type: columnType(schema, defs),
      nullable: isNullable(pathKey(jsonPath), schema, required),
    });

  const envelope = env.FactEnvelope;
  for (const [key, schema] of Object.entries(envelope.properties)) {
    if (key === 'loc') {
      const loc = env.Loc;
      for (const [lk, ls] of Object.entries(loc.properties)) {
        push(lk, `$.loc.${lk}`, ls, env, loc.required ?? []);
      }
    } else {
      push(key, `$.${key}`, schema, env, envelope.required ?? []);
    }
  }

  const value = val.FactValue;
  for (const [key, schema] of Object.entries(value.properties)) {
    // `type` would collide with the SQL keyword; the established name is value_type.
    push(key === 'type' ? 'value_type' : key, `$.value.${key}`, schema, val, value.required ?? []);
  }
  return columns;
}

/** The last JSONPath segment, used to test membership in a `required` array. */
function pathKey(jsonPath) {
  return jsonPath.split('.').pop();
}

function main() {
  const gen = generator();
  const write = (name, value) =>
    writeFileSync(path.join(SCHEMA_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
  write('fact.schema.json', factSchema(gen));
  write('columns.json', factColumns(gen));
  console.log('generated schema/fact.schema.json and schema/columns.json');
}

// Run as a script (not when imported by the drift test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

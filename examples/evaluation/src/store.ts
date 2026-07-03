/**
 * Store (DOWNSTREAM.md §1). Load a factlas fact stream into an in-process SQLite
 * database (SQLite compiled to WASM via `sql.js` — no native build). One table
 * per fact kind, plus a `facts` union view over the common envelope + value, so
 * a policy can query a single kind's subject columns *or* range across kinds.
 *
 * `fact_id` is the primary key, so re-loading the same facts is an idempotent
 * upsert (`INSERT OR REPLACE`) — exactly the property the content-addressed id
 * exists to give downstream consumers.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import type { Fact } from '@factlas/core';
import initSqlJs, { type Database } from 'sql.js';

const require = createRequire(import.meta.url);

let sqlJs: ReturnType<typeof initSqlJs> | undefined;
/** Initialize the WASM SQLite engine once, locating its .wasm next to sql.js. */
function loadSqlJs(): ReturnType<typeof initSqlJs> {
  if (!sqlJs) {
    const dist = path.dirname(require.resolve('sql.js'));
    sqlJs = initSqlJs({ locateFile: (file) => path.join(dist, file) });
  }
  return sqlJs;
}

/** DDL: one table per fact kind. Envelope + value columns are shared by name. */
const SCHEMA = `
CREATE TABLE jsx_element (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT,
  name TEXT, imported_from TEXT, is_dom INT
);
CREATE TABLE jsx_prop (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT, raw TEXT, norm TEXT, value_type TEXT,
  component TEXT, prop TEXT, element_id TEXT
);
CREATE TABLE jsx_attribute (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT, raw TEXT, norm TEXT, value_type TEXT,
  owner TEXT, attribute TEXT, element_id TEXT
);
CREATE TABLE import_fact (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT, raw TEXT, norm TEXT, value_type TEXT,
  specifier TEXT, local TEXT, import_kind TEXT
);
CREATE TABLE css_declaration (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT, raw TEXT, norm TEXT, value_type TEXT,
  property TEXT, selector TEXT, media TEXT, owner_component TEXT, element_id TEXT
);
CREATE TABLE css_class (
  fact_id TEXT PRIMARY KEY, file TEXT, line INT, col INT, source TEXT,
  certainty TEXT, diagnostic TEXT, raw TEXT, norm TEXT, value_type TEXT,
  token TEXT, utility TEXT, is_arbitrary INT, element_id TEXT
);
`;

/** A view over every kind's shared envelope + value columns, for cross-kind rules. */
const FACTS_VIEW = `
CREATE VIEW facts AS
  SELECT fact_id, 'jsx.element' AS kind, file, line, col, source, certainty,
         diagnostic, NULL AS raw, NULL AS norm, NULL AS value_type FROM jsx_element
  UNION ALL SELECT fact_id, 'jsx.prop', file, line, col, source, certainty,
         diagnostic, raw, norm, value_type FROM jsx_prop
  UNION ALL SELECT fact_id, 'jsx.attribute', file, line, col, source, certainty,
         diagnostic, raw, norm, value_type FROM jsx_attribute
  UNION ALL SELECT fact_id, 'import', file, line, col, source, certainty,
         diagnostic, raw, norm, value_type FROM import_fact
  UNION ALL SELECT fact_id, 'css.declaration', file, line, col, source, certainty,
         diagnostic, raw, norm, value_type FROM css_declaration
  UNION ALL SELECT fact_id, 'css.class', file, line, col, source, certainty,
         diagnostic, raw, norm, value_type FROM css_class;
`;

/** Build an in-memory fact store from a fact stream. */
export async function createFactStore(facts: readonly Fact[]): Promise<Database> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  db.run(SCHEMA);
  for (const fact of facts) insertFact(db, fact);
  db.run(FACTS_VIEW);
  return db;
}

/** Shared envelope columns (in DDL order) for one fact. */
function envelope(fact: Fact): Array<string | number | null> {
  return [
    fact.fact_id,
    fact.file,
    fact.loc.line,
    fact.loc.col,
    fact.source,
    fact.certainty,
    fact.diagnostic ?? null,
  ];
}

/** Value columns (raw, norm, type) for a fact that carries a value. */
function value(fact: Exclude<Fact, { kind: 'jsx.element' }>): Array<string | null> {
  return [fact.value.raw, fact.value.norm, fact.value.type];
}

function insertFact(db: Database, fact: Fact): void {
  switch (fact.kind) {
    case 'jsx.element':
      run(db, 'jsx_element', [
        ...envelope(fact),
        fact.subject.name,
        fact.subject.imported_from,
        fact.subject.is_dom ? 1 : 0,
      ]);
      return;
    case 'jsx.prop':
      run(db, 'jsx_prop', [
        ...envelope(fact),
        ...value(fact),
        fact.subject.component,
        fact.subject.prop,
        fact.subject.element_id,
      ]);
      return;
    case 'jsx.attribute':
      run(db, 'jsx_attribute', [
        ...envelope(fact),
        ...value(fact),
        fact.subject.owner,
        fact.subject.attribute,
        fact.subject.element_id,
      ]);
      return;
    case 'import':
      run(db, 'import_fact', [
        ...envelope(fact),
        ...value(fact),
        fact.subject.specifier,
        fact.subject.local,
        fact.subject.import_kind,
      ]);
      return;
    case 'css.declaration':
      run(db, 'css_declaration', [
        ...envelope(fact),
        ...value(fact),
        fact.subject.property,
        fact.subject.selector,
        fact.subject.media,
        fact.subject.owner_component,
        fact.subject.element_id,
      ]);
      return;
    case 'css.class':
      run(db, 'css_class', [
        ...envelope(fact),
        ...value(fact),
        fact.subject.token,
        fact.subject.utility,
        fact.subject.is_arbitrary ? 1 : 0,
        fact.subject.element_id,
      ]);
      return;
  }
}

/** Idempotent insert of one row into `table`; placeholder count follows the row. */
function run(db: Database, table: string, row: Array<string | number | null>): void {
  const placeholders = new Array(row.length).fill('?').join(',');
  db.run(`INSERT OR REPLACE INTO ${table} VALUES (${placeholders})`, row);
}

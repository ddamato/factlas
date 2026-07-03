/**
 * Store (DOWNSTREAM.md §1). Persist a factlas fact stream into a SQLite database
 * (`better-sqlite3`) — one table per fact kind, plus a `facts` union view over
 * the common envelope + value, so a policy can query a single kind's subject
 * columns *or* range across kinds.
 *
 * `fact_id` is the primary key, so re-loading the same facts is an idempotent
 * upsert (`INSERT OR REPLACE`) — the property the content-addressed id exists to
 * give downstream consumers. The database can be `:memory:` or a file on disk;
 * the file is a real, inspectable artifact you can open with any SQLite client.
 */

import type { Fact } from '@factlas/core';
import Database from 'better-sqlite3';

/** A factlas fact database (a `better-sqlite3` connection). */
export type FactDb = Database.Database;

const SCHEMA = `
DROP VIEW IF EXISTS facts;
DROP TABLE IF EXISTS jsx_element;
DROP TABLE IF EXISTS jsx_prop;
DROP TABLE IF EXISTS jsx_attribute;
DROP TABLE IF EXISTS import_fact;
DROP TABLE IF EXISTS css_declaration;
DROP TABLE IF EXISTS css_class;
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

/** Open a fact database (`:memory:` by default) with the schema applied. */
export function openDatabase(file = ':memory:'): FactDb {
  const db = new Database(file);
  db.exec(SCHEMA);
  return db;
}

/** Insert every fact into its kind's table (idempotent on `fact_id`). */
export function loadFacts(db: FactDb, facts: readonly Fact[]): void {
  const insert = (table: string, cols: number) =>
    db.prepare(`INSERT OR REPLACE INTO ${table} VALUES (${new Array(cols).fill('?').join(',')})`);
  const stmts = {
    jsxElement: insert('jsx_element', 10),
    jsxProp: insert('jsx_prop', 13),
    jsxAttribute: insert('jsx_attribute', 13),
    importFact: insert('import_fact', 13),
    cssDeclaration: insert('css_declaration', 15),
    cssClass: insert('css_class', 14),
  };

  const tx = db.transaction((rows: readonly Fact[]) => {
    for (const fact of rows) {
      switch (fact.kind) {
        case 'jsx.element':
          stmts.jsxElement.run([
            ...envelope(fact),
            fact.subject.name,
            fact.subject.imported_from,
            fact.subject.is_dom ? 1 : 0,
          ]);
          break;
        case 'jsx.prop':
          stmts.jsxProp.run([
            ...envelope(fact),
            ...value(fact),
            fact.subject.component,
            fact.subject.prop,
            fact.subject.element_id,
          ]);
          break;
        case 'jsx.attribute':
          stmts.jsxAttribute.run([
            ...envelope(fact),
            ...value(fact),
            fact.subject.owner,
            fact.subject.attribute,
            fact.subject.element_id,
          ]);
          break;
        case 'import':
          stmts.importFact.run([
            ...envelope(fact),
            ...value(fact),
            fact.subject.specifier,
            fact.subject.local,
            fact.subject.import_kind,
          ]);
          break;
        case 'css.declaration':
          stmts.cssDeclaration.run([
            ...envelope(fact),
            ...value(fact),
            fact.subject.property,
            fact.subject.selector,
            fact.subject.media,
            fact.subject.owner_component,
            fact.subject.element_id,
          ]);
          break;
        case 'css.class':
          stmts.cssClass.run([
            ...envelope(fact),
            ...value(fact),
            fact.subject.token,
            fact.subject.utility,
            fact.subject.is_arbitrary ? 1 : 0,
            fact.subject.element_id,
          ]);
          break;
      }
    }
  });
  tx(facts);
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

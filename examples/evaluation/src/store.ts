/**
 * Store (DOWNSTREAM.md §1). Persist a factlas fact stream into a SQLite database
 * (`better-sqlite3`). Each fact is stored **verbatim** as a JSON row; the common
 * envelope/value fields become indexed SQLite *generated columns*.
 *
 * The column list isn't hand-written here — it's `@factlas/core`'s published
 * **column manifest** (`schema/columns.json`, generated from the Fact types). So a
 * consumer generates its table straight from what factlas ships, and the schema
 * can never drift from the fact shape. Kind-specific subject fields stay in the
 * JSON and are read with `json->>'$.subject.…'` in a policy.
 */

import { createRequire } from 'node:module';
import type { Fact } from '@factlas/core';
import Database from 'better-sqlite3';

/** A factlas fact database (a `better-sqlite3` connection). */
export type FactDb = Database.Database;

/** One entry of `@factlas/core/schema/columns.json`. */
interface FactColumn {
  name: string;
  path: string;
  type: 'text' | 'integer' | 'boolean';
  nullable: boolean;
}

const require = createRequire(import.meta.url);
const COLUMNS = require('@factlas/core/schema/columns.json') as FactColumn[];

const SQL_TYPE: Record<FactColumn['type'], string> = {
  text: 'TEXT',
  integer: 'INT',
  boolean: 'INT',
};

// One generated column per common field, straight from factlas's manifest.
// `fact_id` is stored explicitly as the primary key, so it's excluded here.
const GENERATED = COLUMNS.filter((c) => c.name !== 'fact_id')
  .map((c) => `  ${c.name} ${SQL_TYPE[c.type]} AS (json->>'${c.path}') VIRTUAL`)
  .join(',\n');

const SCHEMA = `
DROP VIEW IF EXISTS facts;
DROP TABLE IF EXISTS facts;
CREATE TABLE facts (
  fact_id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
${GENERATED}
);
CREATE INDEX facts_lookup ON facts(kind, value_type, certainty);
`;

/** Open a fact database (`:memory:` by default) with the schema applied. */
export function openDatabase(file = ':memory:'): FactDb {
  const db = new Database(file);
  db.exec(SCHEMA);
  return db;
}

/** Insert every fact verbatim (idempotent on `fact_id`). */
export function loadFacts(db: FactDb, facts: readonly Fact[]): void {
  const insert = db.prepare('INSERT OR REPLACE INTO facts (fact_id, json) VALUES (?, ?)');
  const tx = db.transaction((rows: readonly Fact[]) => {
    for (const fact of rows) insert.run(fact.fact_id, JSON.stringify(fact));
  });
  tx(facts);
}

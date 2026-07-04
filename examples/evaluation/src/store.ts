/**
 * Store (DOWNSTREAM.md §1). Persist a factlas fact stream into a SQLite database
 * (`better-sqlite3`). Each fact is stored **verbatim** as a JSON row — no schema
 * mirroring the Fact types, no per-kind flattening. The common envelope/value
 * fields are surfaced as SQLite *generated columns* (derived declaratively from the
 * JSON, indexed for fast lookup); anything kind-specific stays in the JSON and is
 * read with `json->>'$.subject.…'` in a policy.
 *
 * This means the store never needs editing when the fact schema evolves: a new kind
 * or subject field just flows in as JSON. `fact_id` is the primary key, so
 * re-loading the same facts is an idempotent upsert — the property the
 * content-addressed id exists to give downstream consumers.
 */

import type { Fact } from '@factlas/core';
import Database from 'better-sqlite3';

/** A factlas fact database (a `better-sqlite3` connection). */
export type FactDb = Database.Database;

// One table. `json` holds the fact verbatim; every other column is derived from it
// by SQLite, so there is nothing to keep in sync with the Fact types.
const SCHEMA = `
DROP VIEW IF EXISTS facts;
DROP TABLE IF EXISTS facts;
CREATE TABLE facts (
  fact_id    TEXT PRIMARY KEY,
  json       TEXT NOT NULL,
  kind       TEXT AS (json->>'$.kind')       VIRTUAL,
  file       TEXT AS (json->>'$.file')       VIRTUAL,
  line       INT  AS (json->>'$.loc.line')   VIRTUAL,
  col        INT  AS (json->>'$.loc.col')    VIRTUAL,
  source     TEXT AS (json->>'$.source')     VIRTUAL,
  certainty  TEXT AS (json->>'$.certainty')  VIRTUAL,
  diagnostic TEXT AS (json->>'$.diagnostic') VIRTUAL,
  value_type TEXT AS (json->>'$.value.type') VIRTUAL,
  norm       TEXT AS (json->>'$.value.norm') VIRTUAL,
  raw        TEXT AS (json->>'$.value.raw')  VIRTUAL
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

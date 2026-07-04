/**
 * The shared evaluation harness — everything both reporters (evalite, SARIF)
 * need, up to the point where they diverge. It prepares the data for evaluation
 * and hands back a queryable fact database plus the policy bundle; running a
 * single policy to its matched rows is the shared primitive. What each reporter
 * does with those rows — score them (`policy.eval.ts`) or serialize them as
 * findings (`sarif.ts`) — is its own file.
 *
 * "Prepare the data for evaluation" (DOWNSTREAM.md §1–3): extract the sample app
 * to facts, load them **verbatim** into a SQLite store whose common columns come
 * straight from `@factlas/core`'s published column manifest (`columns.json`), and
 * load the design-system policy bundle. Facts are compared directly to policies —
 * nothing massages the data in between.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRepo, type Fact } from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import jsx from '@factlas/plugin-jsx';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';
import Database from 'better-sqlite3';

/** A factlas fact database (a `better-sqlite3` connection). */
export type FactDb = Database.Database;

/** One row selected by a policy's SQL — column name → value. */
export type Row = Record<string, unknown>;

/** SARIF-aligned severity. `error` fails the CI gate; the rest are advisory. */
export type Level = 'error' | 'warning' | 'note';

/** One policy — the machine-checkable form of a single guideline section. */
export interface Policy {
  id: string;
  /** The guideline this policy enforces, e.g. `guidelines.md#color`. */
  guideline: string;
  level: Level;
  /** SQL selecting violation rows; zero rows = pass. */
  sql: string;
  /** Message template; `{column}` placeholders are filled from the matched row. */
  message: string;
  help: string;
}

/** A versioned set of policies (the "policy bundle" of DOWNSTREAM.md §3). */
export interface PolicySet {
  name: string;
  version: string;
  description: string;
  policies: Policy[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../app');
// The policy bundle lives next to the guidelines and tokens it's compiled from.
const POLICY_URL = new URL('../../design-system/policy.json', import.meta.url);

// --- The store (DOWNSTREAM.md §1). Each fact is a JSON row; the common
// envelope/value fields become indexed generated columns, built from the
// column manifest factlas ships so the schema can't drift from the fact shape. ---

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

// One generated column per common field. `fact_id` is the explicit primary key.
const GENERATED = COLUMNS.filter((column) => column.name !== 'fact_id')
  .map((column) => `  ${column.name} ${SQL_TYPE[column.type]} AS (json->>'${column.path}') VIRTUAL`)
  .join(',\n');

const SCHEMA = `
DROP TABLE IF EXISTS facts;
CREATE TABLE facts (
  fact_id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
${GENERATED}
);
CREATE INDEX facts_lookup ON facts(kind, value_type, certainty);
`;

/** Insert every fact verbatim as a JSON row (idempotent on `fact_id`). */
function loadFacts(db: FactDb, facts: readonly Fact[]): void {
  const insert = db.prepare('INSERT OR REPLACE INTO facts (fact_id, json) VALUES (?, ?)');
  const tx = db.transaction((rows: readonly Fact[]) => {
    for (const fact of rows) insert.run(fact.fact_id, JSON.stringify(fact));
  });
  tx(facts);
}

/**
 * Prepare everything for evaluation: extract the sample app to facts, load them
 * into an in-memory fact database, and load the policy bundle it's checked
 * against. Returns the ready-to-query database and the policy set.
 */
export async function prepare(): Promise<{ db: FactDb; policySet: PolicySet }> {
  const { facts } = await extractRepo({
    root: APP,
    plugins: [jsx, cssPlugin, inlineStyle, styled, tailwind],
  });
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  loadFacts(db, facts);

  const policySet = JSON.parse(await readFile(POLICY_URL, 'utf8')) as PolicySet;
  return { db, policySet };
}

/** Run one policy's SQL; each returned row is one violation of that policy. */
export function runPolicy(db: FactDb, policy: Policy): Row[] {
  return db.prepare(policy.sql).all() as Row[];
}

/**
 * The "load facts into a store" step (DOWNSTREAM.md §1) as one call: open a
 * database (in memory or on disk) and load the fact stream. The result is a
 * ready-to-query fact DB — nothing but facts. Policies compare facts to their own
 * predicates; there is no reference/allowed-set layer massaging data in between.
 */

import type { Fact } from '@factlas/core';
import { type FactDb, loadFacts, openDatabase } from './store.js';

export interface BuildDatabaseOptions {
  /** File path for an on-disk database; omit for an in-memory one. */
  file?: string;
}

/** Build a fact database from a fact stream. */
export function buildDatabase(facts: readonly Fact[], options: BuildDatabaseOptions = {}): FactDb {
  const db = openDatabase(options.file);
  loadFacts(db, facts);
  return db;
}

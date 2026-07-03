/**
 * The "load facts into a store" step (DOWNSTREAM.md §1–2) as one call: open a
 * database (in memory or on disk), load the fact stream, and attach the
 * normalized token allowed-sets. The result is a ready-to-query fact DB.
 */

import type { Fact } from '@factlas/core';
import { loadAllowedSets } from './reference.js';
import { type FactDb, loadFacts, openDatabase } from './store.js';

export interface BuildDatabaseOptions {
  /** File path for an on-disk database; omit for an in-memory one. */
  file?: string;
}

/** Build a fact database from a fact stream, with allowed-sets loaded. */
export async function buildDatabase(
  facts: readonly Fact[],
  options: BuildDatabaseOptions = {},
): Promise<FactDb> {
  const db = openDatabase(options.file);
  loadFacts(db, facts);
  await loadAllowedSets(db);
  return db;
}

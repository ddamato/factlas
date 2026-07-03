/**
 * Reference / allowed-sets (DOWNSTREAM.md §2). Turn the design system's tokens
 * into `ref_allowed_*` tables the policies compare facts against.
 *
 * The one rule that must not be broken: **normalize the reference with the same
 * `NORMALIZER_VERSION` code the fact layer uses.** A fact's `color` value went
 * through `@factlas/core`'s `normalizeColor`; if we compared it against a raw
 * token like `#3366FF` the strings would differ (`#3366ff` vs `#3366FF`) and
 * every check would silently misfire. So we import the very same normalizers
 * rather than reimplementing them.
 */

import { readFile } from 'node:fs/promises';
import { normalizeColor, normalizeLength } from '@factlas/core';
import type { Database } from 'sql.js';

/** Minimal DTCG token shape (only what this demo reads). */
interface DtcgToken {
  $type?: string;
  $value?: string;
}
interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken;
}

const TOKENS_URL = new URL('../reference/tokens.json', import.meta.url);

/** Flatten a DTCG tree into `{ path, type, value }` leaves. */
function* leaves(
  group: DtcgGroup,
  trail: string[] = [],
): Generator<{ path: string; type: string; value: string }> {
  for (const [key, node] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    const token = node as DtcgToken;
    if (typeof token.$value === 'string') {
      yield { path: [...trail, key].join('.'), type: token.$type ?? '', value: token.$value };
    } else {
      yield* leaves(node as DtcgGroup, [...trail, key]);
    }
  }
}

/**
 * Load the token file, normalize each value with the fact-layer normalizers, and
 * populate `ref_allowed_colors` / `ref_allowed_lengths`. Each row keeps the token
 * name for nicer violation messages and audit.
 */
export async function loadAllowedSets(db: Database): Promise<void> {
  db.run(`
    CREATE TABLE ref_allowed_colors (token TEXT, raw TEXT, norm TEXT PRIMARY KEY);
    CREATE TABLE ref_allowed_lengths (token TEXT, raw TEXT, norm TEXT PRIMARY KEY);
  `);

  const tree = JSON.parse(await readFile(TOKENS_URL, 'utf8')) as DtcgGroup;
  for (const { path, type, value } of leaves(tree)) {
    if (type === 'color') {
      const norm = normalizeColor(value);
      if (norm)
        db.run('INSERT OR IGNORE INTO ref_allowed_colors VALUES (?,?,?)', [path, value, norm]);
    } else if (type === 'dimension') {
      const norm = normalizeLength(value);
      if (norm)
        db.run('INSERT OR IGNORE INTO ref_allowed_lengths VALUES (?,?,?)', [path, value, norm]);
    }
  }
}

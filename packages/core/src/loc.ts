/**
 * Location converters (Phase 2 utility).
 *
 * Babel and PostCSS disagree on column bases: Babel columns are 0-based, PostCSS
 * columns are 1-based. Everything in Factlas uses the {@link Loc} convention —
 * 1-based line, 0-based column — so all extractors funnel through these helpers
 * and locations stay comparable across sources (and stable in `fact_id`s).
 */

import type { Loc } from './fact.js';

interface BabelPositioned {
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  } | null;
}

interface PostcssPositioned {
  source?: {
    start?: { line: number; column: number };
    end?: { line: number; column: number };
  };
}

const EMPTY_LOC: Loc = { line: 0, col: 0, endLine: 0, endCol: 0 };

/** Convert a Babel node's location to a {@link Loc} (columns already 0-based). */
export function babelLoc(node: BabelPositioned): Loc {
  const l = node.loc;
  if (!l) return { ...EMPTY_LOC };
  return {
    line: l.start.line,
    col: l.start.column,
    endLine: l.end.line,
    endCol: l.end.column,
  };
}

/** Convert a PostCSS node's location to a {@link Loc} (columns → 0-based). */
export function postcssLoc(node: PostcssPositioned): Loc {
  const s = node.source?.start;
  const e = node.source?.end;
  if (!s) return { ...EMPTY_LOC };
  return {
    line: s.line,
    col: s.column - 1,
    endLine: e?.line ?? s.line,
    // PostCSS end column is 1-based inclusive; treat as 0-based exclusive.
    endCol: e ? e.column : s.column - 1,
  };
}

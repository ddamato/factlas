/**
 * Tailwind class-token parsing.
 *
 * Splits a class token into its parts without depending on the Tailwind engine:
 * the utility namespace, whether it uses an arbitrary value (`text-[#fff]`), and
 * the arbitrary value itself (classified by shape). Variants (`hover:`, `md:`,
 * and arbitrary `[&:hover]:`) are stripped when computing the utility.
 */

import type { ValueType } from '@factlas/core';

export interface ParsedToken {
  /** The full authored token, including variants (the fact subject). */
  token: string;
  /** The utility namespace, e.g. `bg`, `text`, `-mt`, `flex`. */
  utility: string;
  /**
   * The utility path with variants and the `[value]` stripped — the resolution
   * key, e.g. `text`, `min-w`, `border-t`, `mt`. Distinct from `utility`, which
   * collapses to the first segment; `prefix` keeps compound utilities whole.
   */
  prefix: string;
  /** True when the token carries an arbitrary value in brackets. */
  is_arbitrary: boolean;
  /** The arbitrary value (bracket contents), or `null`. */
  arbitrary: string | null;
}

/** Parse a single Tailwind class token. */
export function parseToken(token: string): ParsedToken {
  const base = stripVariants(token);
  const arbitrary = arbitraryValueOf(base);
  return {
    token,
    utility: utilityOf(base),
    prefix: prefixOf(base),
    is_arbitrary: arbitrary !== null,
    arbitrary,
  };
}

/** The utility path before the arbitrary `[value]`, with negativity and dashes trimmed. */
function prefixOf(base: string): string {
  const withoutArbitrary = base.includes('[') ? base.slice(0, base.indexOf('[')) : base;
  return withoutArbitrary.replace(/-+$/, '').replace(/^-+/, '');
}

/** Classify an arbitrary value by its shape (property context is unknown). */
export function classifyArbitrary(content: string): ValueType {
  const v = content.replace(/_/g, ' ').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|rgba|hsl|hsla)\(/i.test(v)) return 'color';
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]+$/i.test(v)) return 'length';
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(v)) return 'number';
  if (/\s/.test(v)) return 'keyword';
  return 'keyword';
}

/** Strip leading variants, honoring brackets so `[&:hover]:` stays intact. */
function stripVariants(token: string): string {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) lastColon = i;
  }
  return token.slice(lastColon + 1);
}

function utilityOf(base: string): string {
  const negative = base.startsWith('-');
  const body = negative ? base.slice(1) : base;
  const beforeBracket = body.split('[')[0] ?? body;
  const first = beforeBracket.split('-').filter(Boolean)[0] ?? beforeBracket;
  return `${negative ? '-' : ''}${first}`;
}

function arbitraryValueOf(base: string): string | null {
  const match = /\[([^\]]*)\]/.exec(base);
  return match ? (match[1] as string) : null;
}

/**
 * Keyword normalization.
 *
 * Lowercases and trims CSS keyword values, then applies an alias table so
 * synonyms collapse (extend {@link KEYWORD_ALIASES} as real aliases surface).
 * Part of the {@link NORMALIZER_VERSION} surface — adding an alias is a migration.
 */

/** Canonical keyword aliases, `variant` → `canonical`. */
export const KEYWORD_ALIASES: Readonly<Record<string, string>> = {
  // e.g. 'transparent': 'transparent' — populated as real aliases are needed.
};

/** Normalize a keyword to its lowercase, trimmed, alias-resolved form. */
export function normalizeKeyword(raw: string): string {
  const key = raw.trim().toLowerCase();
  return KEYWORD_ALIASES[key] ?? key;
}

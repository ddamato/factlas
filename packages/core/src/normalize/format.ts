/**
 * Shared numeric formatting for normalizers (Phase 3).
 *
 * A single, locale-independent number canonicalizer so `10.0`, `+10`, and `10`
 * all collapse to `10`, and `.5` → `0.5`. Used by the length and number
 * normalizers; part of the {@link NORMALIZER_VERSION} surface.
 */

/** A single numeric token pattern (no unit): `-1`, `+2.5`, `.5`, `10.`. */
export const NUMERIC_TOKEN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Canonicalize a numeric token to its shortest stable decimal form.
 * Returns the trimmed input unchanged if it is not a finite number.
 */
export function formatNumber(token: string): string {
  const trimmed = token.trim();
  if (trimmed === '' || !NUMERIC_TOKEN.test(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  // String(-0) === '0', so negative zero is normalized away.
  return String(n);
}

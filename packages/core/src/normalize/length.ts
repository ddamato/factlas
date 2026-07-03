/**
 * Length normalization (ADR §3 Phase 3 step 8).
 *
 * Canonicalizes numeric value + unit: `10.0PX` → `10px`, `.5rem` → `0.5rem`,
 * `-2EM` → `-2em`. A bare `0` becomes `0px` (the common length identity). Units
 * are lowercased; numbers are canonicalized via {@link formatNumber}. Input that
 * is not a length returns `null`.
 *
 * Part of the {@link NORMALIZER_VERSION} surface.
 */

import { formatNumber } from './format.js';

/** number + optional unit, e.g. `10px`, `-.5rem`, `50%`, `0`. */
const LENGTH_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]+)?$/i;

/** Normalize a length string, or `null` if it is not a length. */
export function normalizeLength(raw: string): string | null {
  const match = LENGTH_RE.exec(raw.trim());
  if (!match) return null;
  const num = formatNumber(match[1] as string);
  const unit = match[2]?.toLowerCase();
  if (!unit) return num === '0' ? '0px' : num;
  return `${num}${unit}`;
}

/**
 * Color normalization.
 *
 * Canonicalizes any parseable color to lowercase hex: `#FFF` → `#ffffff`,
 * `#abc` → `#aabbcc`, `rgb(255,0,0)` → `#ff0000`, named colors → hex. Colors
 * with partial alpha use 8-digit hex (`rgba(255,0,0,.5)` → `#ff000080`). This is
 * what lets `#FFF` and `#ffffff` collapse to one `fact_id`. Unparseable input
 * returns `null` (the caller emits an honest `unknown`, never a silent drop).
 *
 * Part of the {@link NORMALIZER_VERSION} surface — any change here is a migration.
 */

import { formatHex, formatHex8, parse } from 'culori';

/** Normalize a color string to canonical hex, or `null` if unparseable. */
export function normalizeColor(raw: string): string | null {
  const color = parse(raw.trim());
  if (!color) return null;
  const alpha = color.alpha;
  return alpha !== undefined && alpha < 1 ? formatHex8(color) : formatHex(color);
}

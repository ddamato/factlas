/**
 * Value normalization dispatcher (Phase 3).
 *
 * Routes a raw value to the normalizer for its {@link ValueType} and returns the
 * canonical `norm` (or `null` when it cannot be normalized, or when the type is
 * not directly comparable — `union`/`dynamic`). This is the single function that
 * facts and reference/allowed-set tables must both use (ADR §2.4 rule 7).
 *
 * Part of the {@link NORMALIZER_VERSION} surface.
 */

import type { ValueType } from '../fact.js';
import { normalizeColor } from './color.js';
import { NUMERIC_TOKEN, formatNumber } from './format.js';
import { normalizeKeyword } from './keyword.js';
import { normalizeLength } from './length.js';

/** Normalize a raw value by type. Returns `null` if not normalizable/comparable. */
export function normalizeValue(type: ValueType, raw: string): string | null {
  switch (type) {
    case 'color':
      return normalizeColor(raw);
    case 'length':
      return normalizeLength(raw);
    case 'number': {
      const trimmed = raw.trim();
      return NUMERIC_TOKEN.test(trimmed) ? formatNumber(trimmed) : null;
    }
    case 'keyword':
      return normalizeKeyword(raw);
    case 'string':
      // Strings are opaque; the raw content is already canonical.
      return raw;
    case 'url':
      return normalizeUrl(raw);
    case 'module':
      return raw.trim();
    case 'shadow':
      // Collapse internal whitespace; full shadow modeling is future work.
      return raw.trim().replace(/\s+/g, ' ');
    case 'union':
    case 'dynamic':
      // Not a single comparable value; certainty routing handles these.
      return null;
    default:
      return null;
  }
}

/** Normalize a `url(...)` value to `url(<inner>)`, or `null` if malformed. */
function normalizeUrl(raw: string): string | null {
  const match = /^url\(\s*(['"]?)([^'")]*)\1\s*\)$/i.exec(raw.trim());
  if (!match) return null;
  return `url(${(match[2] as string).trim()})`;
}

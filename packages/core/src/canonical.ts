/**
 * Canonical JSON serialization + hashing — the determinism primitives.
 *
 * `canonicalStringify` produces a byte-stable string for a given value: object
 * keys are sorted, `undefined`-valued properties are omitted, and numbers use a
 * fixed, locale-independent representation. This is the substrate for
 * content-addressed `fact_id`s and the snapshot cache key, so its output must
 * never depend on insertion order, platform, or locale.
 */

import { createHash } from 'node:crypto';

/**
 * Serialize a JSON-compatible value to a canonical string.
 *
 * Guarantees:
 * - object keys sorted ascending by UTF-16 code unit (locale-independent);
 * - properties whose value is `undefined` are omitted (never emitted as `null`);
 * - arrays preserve order (order is meaningful);
 * - only finite numbers, booleans, strings, `null`, arrays, and plain objects
 *   are accepted — anything else (function, symbol, bigint, NaN/Infinity) throws.
 */
export function canonicalStringify(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot canonicalize non-finite number: ${value}`);
      }
      // JSON.stringify uses a fixed, locale-independent number format.
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(serialize).join(',')}]`;
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort(compareCodeUnits);
      const parts: string[] = [];
      for (const key of keys) {
        const v = obj[key];
        if (v === undefined) continue; // omit undefined, never serialize it
        parts.push(`${JSON.stringify(key)}:${serialize(v)}`);
      }
      return `{${parts.join(',')}}`;
    }
    default:
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }
}

/** Locale-independent string comparison by UTF-16 code unit. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lowercase hex sha256 of a string or byte buffer. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * CSS value-type classification for inline style values.
 *
 * Mirrors the conservative classifier in `@factlas/plugin-css` (kept local so the
 * packages stay independent). Types confident cases; falls back to `keyword`.
 */

import type { ValueType } from '@factlas/core';

const HEX = /^#[0-9a-f]{3,8}$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;
const LENGTH = /^[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]+$/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const URL = /^url\(/i;
const NAMED_TOKEN = /^[a-z][a-z-]*$/i;

/** Kebab-case color properties (inline keys are normalized to kebab by core). */
const COLOR_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'border-color',
  'outline-color',
  'caret-color',
  'fill',
  'stroke',
]);

/** Classify an inline style value's type given its (camelCase or kebab) property. */
export function classifyCssValueType(property: string, value: string): ValueType {
  const v = value.trim();
  const prop = toKebab(property);

  if (URL.test(v)) return 'url';
  if (HEX.test(v) || COLOR_FN.test(v)) return 'color';

  if (isSingleToken(v)) {
    if (LENGTH.test(v)) return 'length';
    if (NUMBER.test(v)) return 'number';
    if (COLOR_PROPS.has(prop) && NAMED_TOKEN.test(v)) return 'color';
    return 'keyword';
  }
  return 'keyword';
}

function isSingleToken(value: string): boolean {
  return value !== '' && !/\s/.test(value);
}

function toKebab(property: string): string {
  return property
    .trim()
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .toLowerCase();
}

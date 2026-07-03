/**
 * CSS value-type classification for styled/emotion declaration values.
 * Mirrors `@factlas/plugin-css` (kept local for package independence).
 */

import type { ValueType } from '@factlas/core';

const HEX = /^#[0-9a-f]{3,8}$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;
const LENGTH = /^[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]+$/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const URL = /^url\(/i;
const NAMED_TOKEN = /^[a-z][a-z-]*$/i;
const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', '-webkit-box-shadow']);
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

/** Classify a declaration value's type given its property. */
export function classifyCssValueType(property: string, value: string): ValueType {
  const v = value.trim();
  const prop = property.trim().toLowerCase();

  if (URL.test(v)) return 'url';
  if (HEX.test(v) || COLOR_FN.test(v)) return 'color';
  if (SHADOW_PROPS.has(prop)) return 'shadow';

  if (v !== '' && !/\s/.test(v)) {
    if (LENGTH.test(v)) return 'length';
    if (NUMBER.test(v)) return 'number';
    if (COLOR_PROPS.has(prop) && NAMED_TOKEN.test(v)) return 'color';
    return 'keyword';
  }
  return 'keyword';
}

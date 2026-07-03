/**
 * CSS value-type classification.
 *
 * A plugin's job is to classify a value's {@link ValueType} (core does the
 * actual normalization). This is a conservative classifier: it types values it
 * is confident about (hex/color-function colors, `<number><unit>` lengths, bare
 * numbers, `url(...)`, shadows) and falls back to `keyword` for anything
 * multi-token or ambiguous, so `raw` is always preserved and nothing is
 * mis-normalized.
 */

import type { ValueType } from '@factlas/core';

const HEX = /^#[0-9a-f]{3,8}$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i;
const LENGTH = /^[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]+$/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const URL = /^url\(/i;
const NAMED_TOKEN = /^[a-z][a-z-]*$/i;

const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', '-webkit-box-shadow']);

/** Properties whose single-word value is most likely a (named) color. */
const COLOR_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'caret-color',
  'text-decoration-color',
  'column-rule-color',
  'fill',
  'stroke',
]);

/** Classify a CSS declaration's value type given its (kebab-case) property. */
export function classifyCssValueType(property: string, value: string): ValueType {
  const v = value.trim();
  const prop = property.trim().toLowerCase();

  if (URL.test(v)) return 'url';
  if (HEX.test(v) || COLOR_FN.test(v)) return 'color';
  if (SHADOW_PROPS.has(prop)) return 'shadow';

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

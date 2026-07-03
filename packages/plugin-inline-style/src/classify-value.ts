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

/**
 * Properties whose bare numeric value React leaves unitless (everything else is
 * treated as `px`). Mirrors React DOM's `isUnitlessNumber`. Keys are compared in
 * a dash-insensitive, lowercased form so both `zIndex` and `z-index` match.
 */
const UNITLESS_NUMBER_PROPS = new Set(
  [
    'animationIterationCount',
    'aspectRatio',
    'borderImageOutset',
    'borderImageSlice',
    'borderImageWidth',
    'boxFlex',
    'boxFlexGroup',
    'boxOrdinalGroup',
    'columnCount',
    'columns',
    'flex',
    'flexGrow',
    'flexPositive',
    'flexShrink',
    'flexNegative',
    'flexOrder',
    'gridArea',
    'gridRow',
    'gridRowEnd',
    'gridRowSpan',
    'gridRowStart',
    'gridColumn',
    'gridColumnEnd',
    'gridColumnSpan',
    'gridColumnStart',
    'fontWeight',
    'lineClamp',
    'lineHeight',
    'opacity',
    'order',
    'orphans',
    'scale',
    'tabSize',
    'widows',
    'zIndex',
    'zoom',
    'fillOpacity',
    'floodOpacity',
    'stopOpacity',
    'strokeDasharray',
    'strokeDashoffset',
    'strokeMiterlimit',
    'strokeOpacity',
    'strokeWidth',
  ].map(unitlessKey),
);

/**
 * True when a bare numeric on `property` is unitless in React (`zIndex: 10`);
 * false when React would append `px` (`width: 10` → `10px`), which the extractor
 * therefore records as a `length`.
 */
export function isUnitlessNumberProperty(property: string): boolean {
  return UNITLESS_NUMBER_PROPS.has(unitlessKey(property));
}

/** Dash-insensitive, lowercased key for unitless-property comparison. */
function unitlessKey(property: string): string {
  return property.replace(/-/g, '').toLowerCase();
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

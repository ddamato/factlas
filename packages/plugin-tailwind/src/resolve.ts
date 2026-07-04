/**
 * Arbitrary-value resolution (v1) — map a Tailwind arbitrary utility to the CSS
 * declaration(s) it sets, without the Tailwind engine.
 *
 * A class like `text-[#123456]` or `px-[10px]` carries its value inline, so the
 * only thing needed is the property: a deterministic lookup keyed on the utility
 * prefix, disambiguated by the value's classified type (Tailwind overloads some
 * prefixes — `text-` is a color *or* a font-size, `border-` is a color *or* a
 * width). This lets an arbitrary Tailwind value become a real `css.declaration`
 * fact, so the same color/spacing policies that judge CSS also judge Tailwind.
 *
 * Scale/theme utilities (`bg-red-500` → `#ef4444`) need the config-driven engine
 * and are out of scope here; those tokens stay `css.class`-only.
 */

import type { ValueType } from '@factlas/core';

/** The CSS property/properties a utility sets, keyed by the value's type. */
interface Mapping {
  color?: readonly string[];
  length?: readonly string[];
  number?: readonly string[];
}

// Utility prefix (see ParsedToken.prefix) → CSS declarations. Only value-carrying
// utilities are listed; anything absent stays a `css.class` fact with no resolved
// declaration. Prefixes that set several properties (`px` → left + right) list
// them all.
const MAP: Record<string, Mapping> = {
  // Colors
  bg: { color: ['background-color'] },
  text: { color: ['color'], length: ['font-size'] },
  border: { color: ['border-color'], length: ['border-width'] },
  'border-x': {
    color: ['border-left-color', 'border-right-color'],
    length: ['border-left-width', 'border-right-width'],
  },
  'border-y': {
    color: ['border-top-color', 'border-bottom-color'],
    length: ['border-top-width', 'border-bottom-width'],
  },
  'border-t': { color: ['border-top-color'], length: ['border-top-width'] },
  'border-r': { color: ['border-right-color'], length: ['border-right-width'] },
  'border-b': { color: ['border-bottom-color'], length: ['border-bottom-width'] },
  'border-l': { color: ['border-left-color'], length: ['border-left-width'] },
  outline: { color: ['outline-color'], length: ['outline-width'] },
  fill: { color: ['fill'] },
  stroke: { color: ['stroke'], length: ['stroke-width'] },
  caret: { color: ['caret-color'] },
  accent: { color: ['accent-color'] },
  decoration: { color: ['text-decoration-color'], length: ['text-decoration-thickness'] },
  // Sizing
  w: { length: ['width'] },
  h: { length: ['height'] },
  'min-w': { length: ['min-width'] },
  'max-w': { length: ['max-width'] },
  'min-h': { length: ['min-height'] },
  'max-h': { length: ['max-height'] },
  size: { length: ['width', 'height'] },
  basis: { length: ['flex-basis'] },
  // Padding / margin
  p: { length: ['padding'] },
  px: { length: ['padding-left', 'padding-right'] },
  py: { length: ['padding-top', 'padding-bottom'] },
  pt: { length: ['padding-top'] },
  pr: { length: ['padding-right'] },
  pb: { length: ['padding-bottom'] },
  pl: { length: ['padding-left'] },
  m: { length: ['margin'] },
  mx: { length: ['margin-left', 'margin-right'] },
  my: { length: ['margin-top', 'margin-bottom'] },
  mt: { length: ['margin-top'] },
  mr: { length: ['margin-right'] },
  mb: { length: ['margin-bottom'] },
  ml: { length: ['margin-left'] },
  // Gaps
  gap: { length: ['gap'] },
  'gap-x': { length: ['column-gap'] },
  'gap-y': { length: ['row-gap'] },
  // Positioning
  top: { length: ['top'] },
  right: { length: ['right'] },
  bottom: { length: ['bottom'] },
  left: { length: ['left'] },
  inset: { length: ['top', 'right', 'bottom', 'left'] },
  'inset-x': { length: ['left', 'right'] },
  'inset-y': { length: ['top', 'bottom'] },
  // Typography / radius
  leading: { length: ['line-height'], number: ['line-height'] },
  tracking: { length: ['letter-spacing'] },
  indent: { length: ['text-indent'] },
  rounded: { length: ['border-radius'] },
  // Numeric
  z: { number: ['z-index'] },
  opacity: { number: ['opacity'] },
};

/**
 * Resolve an arbitrary Tailwind utility to the CSS property/properties it sets.
 * `prefix` is the utility path (variants and the `[value]` stripped, e.g. `text`,
 * `min-w`, `mt`); `valueType` is the arbitrary value's classified type. Returns
 * the properties (possibly several), or `[]` when it isn't a known value-carrying
 * utility for that value type.
 */
export function resolveProperties(prefix: string, valueType: ValueType): readonly string[] {
  const mapping = MAP[prefix];
  if (!mapping) return [];
  if (valueType === 'color') return mapping.color ?? [];
  if (valueType === 'length') return mapping.length ?? [];
  if (valueType === 'number') return mapping.number ?? [];
  return [];
}

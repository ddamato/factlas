/**
 * CSS property-name normalization.
 *
 * Canonicalizes property names to kebab-case so an inline `backgroundColor` and
 * a stylesheet's `background-color` describe the same property (and collapse in
 * `fact_id`). Vendor prefixes follow the React inline-style spelling:
 * `WebkitTransform` → `-webkit-transform`, `msFlex` → `-ms-flex`. Custom
 * properties (`--token`) are passed through with case preserved.
 *
 * Part of the {@link NORMALIZER_VERSION} surface.
 */

/** Normalize a CSS/inline-style property name to canonical kebab-case. */
export function normalizeProperty(raw: string): string {
  const prop = raw.trim();
  // Custom properties are case-sensitive; never transform them.
  if (prop.startsWith('--')) return prop;
  // Already kebab (or plain) with no camelCase to convert.
  if (!/[A-Z]/.test(prop)) return prop.toLowerCase();
  const kebab = prop.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
  // `msFlex` → `ms-flex` → `-ms-flex` (the `ms` prefix is lowercase in JS).
  return kebab.startsWith('ms-') ? `-${kebab}` : kebab;
}

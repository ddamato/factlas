// Design tokens as plain constants — exercises one-hop const resolution.
export const BRAND = '#3366FF';
export const BRAND_HOVER = '#2851d6';
export const SPACE_SM = '4px';
export const RADIUS = '8px';

// A nested object imported by components. In-file member access resolves one hop,
// but the resolver never crosses a module boundary — so a consumer's
// `colors.danger` stays `unknown` (member-object-unresolved), a value the
// downstream evaluation demo routes to `needs-review` rather than pass/fail.
export const colors = {
  danger: '#E00',
  success: 'green',
} as const;

// Design tokens as plain constants — exercises one-hop const resolution.
export const BRAND = '#3366FF';
export const BRAND_HOVER = '#2851d6';
export const SPACE_SM = '4px';
export const RADIUS = '8px';

// A nested object — member access is intentionally NOT statically resolved
// (the resolver stops at one hop, literals only), so reads become `unknown`.
export const colors = {
  danger: '#E00',
  success: 'green',
} as const;

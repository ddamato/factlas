// The design system's consumable token bindings — what an app imports to build
// UI. In a real system this file is generated from `tokens.json` (the DTCG source
// of truth) by a tool like Style Dictionary; here the two are kept in sync by hand.
//
// The app under examples/app imports these, so you can see it *consuming* the
// design system rather than redefining values locally. Note the static-analysis
// consequence: because factlas never executes code and its resolver stays in-file,
// a value read across this module boundary is honestly `dynamic`/`unknown` at the
// use site — which is exactly why the evaluation demo routes such facts to
// `needs-review` instead of pass/fail.

export const BRAND = '#3366FF';
export const BRAND_HOVER = '#2851d6';
export const SPACE_SM = '4px';
export const RADIUS = '8px';

// A nested token object. In-file member access resolves one hop, but the resolver
// never crosses a module boundary — so a consumer's `colors.danger` stays
// `unknown` (member-object-unresolved), routed to `needs-review` downstream.
export const colors = {
  danger: '#E00',
  success: 'green',
} as const;

---
"@factlas/core": minor
"@factlas/plugin-inline-style": minor
---

Normalizer v0.2 migration (`NORMALIZER_VERSION` 0.1.0 → 0.2.0). Resolves more
values statically and models React's inline-numeric semantics. **This is a
migration** — re-extract; old and new `norm`/`certainty` are not comparable.

- **Member access.** The bounded resolver now resolves `obj.key` /
  `obj['key']` against an in-file `const` object literal to that property's
  literal, and a dynamic key (`obj[x]`) to the static union of the object's
  literal values. Still bounded: one hop to the object, literal values only, no
  crossing module boundaries or spreads.
- **Unary sign.** Numeric `-4` / `+8` now resolve to literals (previously
  dynamic), so negative inline lengths work.
- **Inline numeric px.** A bare number on a dimensional CSS property is recorded
  as a `px` length (`width: 10` → `10px`), matching React; the unitless set
  (`opacity`, `zIndex`, `lineHeight`, `flexGrow`, …) stays a plain `number`. The
  length normalizer now treats a unitless number as `px`.

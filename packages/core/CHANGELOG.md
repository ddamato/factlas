# @factlas/core

## 0.1.0

### Minor Changes

- c5d154e: Normalizer v0.2 migration (`NORMALIZER_VERSION` 0.1.0 → 0.2.0). Resolves more
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

### Patch Changes

- fa1790c: Populate the snapshot header's `tool_versions`. `extractRepo` now records the
  resolved versions of factlas's parser/normalizer dependencies (`@babel/parser`,
  `@babel/traverse`, `@babel/types`, `culori`, `postcss`, `postcss-value-parser`,
  `fast-glob`) so a tool upgrade becomes a visible determinism input and changes the
  run `cache_key`. Exposes `toolVersions()` and `TOOL_PACKAGES`; an explicit
  `toolVersions` passed to `extractRepo`/`discover` still takes precedence.

## 0.0.2

### Patch Changes

- be75e71: Cross-plugin element linkage. Core now exposes shared JSX element-identity
  helpers — `buildImportMap`, `jsxElementIdentity`, `jsxElementId`,
  `jsxElementName`, `isIntrinsicElement` — so every plugin computes the same
  content-addressed `element_id` for a given element. `plugin-tailwind` uses them
  to set `element_id` on `css.class` facts, so a Tailwind class now joins back to
  its owning `jsx.element` (and thus its `imported_from`). `plugin-jsx` derives its
  element ids from the same helper, guaranteeing the two agree.

# @factlas/plugin-inline-style

## 2.0.0

### Minor Changes

- 9fe29c7: Schema v0.2 migration (`FACT_SCHEMA_VERSION` 0.1.0 → 0.2.0). Adds an
  `element_id` foreign key to `css.declaration` so inline styles join to their
  owning element. **This is a migration** — re-extract; `fact_id`s for
  `css.declaration` change.

  - `CssDeclarationSubject` gains `element_id: string | null` (JSON Schema updated).
  - `plugin-inline-style` sets it to the content-addressed `fact_id` of the owning
    `jsx.element` (via core's shared `jsxElementId`), so an inline declaration now
    joins back to its element — and thus its `imported_from` — exactly like
    `css.class` and `jsx.prop`/`jsx.attribute`.
  - Stylesheet (`plain-css`/`css-module`) and styled-component (`css-in-js`)
    declarations set `element_id: null`: they aren't bound to a single element
    instance.

### Patch Changes

- Updated dependencies [9fe29c7]
  - @factlas/core@0.2.0

## 1.0.0

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

- Updated dependencies [c5d154e]
- Updated dependencies [fa1790c]
  - @factlas/core@0.1.0

## 0.0.2

### Patch Changes

- Updated dependencies [be75e71]
  - @factlas/core@0.0.2

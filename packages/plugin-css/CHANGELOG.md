# @factlas/plugin-css

## 3.0.0

### Patch Changes

- Updated dependencies [aa81abf]
  - @factlas/core@0.3.0

## 2.0.0

### Patch Changes

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

- Updated dependencies [9fe29c7]
  - @factlas/core@0.2.0

## 1.0.0

### Patch Changes

- Updated dependencies [c5d154e]
- Updated dependencies [fa1790c]
  - @factlas/core@0.1.0

## 0.0.2

### Patch Changes

- Updated dependencies [be75e71]
  - @factlas/core@0.0.2

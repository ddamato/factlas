# @factlas/plugin-tailwind

## 4.1.0

### Minor Changes

- 34531d2: Arbitrary Tailwind values now resolve to the `css.declaration` fact(s) they set, alongside the existing `css.class` fact. `text-[#123456]` emits a `color` declaration, `px-[10px]` emits `padding-left` / `padding-right`, and so on — so the same color/spacing policies that judge CSS also judge arbitrary Tailwind values.

  The property is resolved by a deterministic, engine-free utility→property map, disambiguated by the value's type (`text-` is a color _or_ a font-size, `border-` a color _or_ a width). Scale/theme utilities like `bg-red-500` still need the config-driven Tailwind engine and remain `css.class`-only.

  Purely additive — existing facts are unchanged; the fact schema and normalizer versions are untouched.

## 4.0.0

### Patch Changes

- Updated dependencies [d486b66]
  - @factlas/core@0.4.0

## 3.0.0

### Patch Changes

- Updated dependencies [aa81abf]
  - @factlas/core@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [9fe29c7]
  - @factlas/core@0.2.0

## 1.0.0

### Patch Changes

- Updated dependencies [c5d154e]
- Updated dependencies [fa1790c]
  - @factlas/core@0.1.0

## 0.0.2

### Patch Changes

- be75e71: Cross-plugin element linkage. Core now exposes shared JSX element-identity
  helpers — `buildImportMap`, `jsxElementIdentity`, `jsxElementId`,
  `jsxElementName`, `isIntrinsicElement` — so every plugin computes the same
  content-addressed `element_id` for a given element. `plugin-tailwind` uses them
  to set `element_id` on `css.class` facts, so a Tailwind class now joins back to
  its owning `jsx.element` (and thus its `imported_from`). `plugin-jsx` derives its
  element ids from the same helper, guaranteeing the two agree.
- Updated dependencies [be75e71]
  - @factlas/core@0.0.2

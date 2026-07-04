# @factlas/core

## 0.4.0

### Minor Changes

- d486b66: The schema artifacts are now **generated from the TypeScript types** (the single source of truth) via `npm run generate`, and a drift test keeps them in sync:

  - **New export — `@factlas/core/schema/columns.json`:** a flat, DB-agnostic column manifest for the common (envelope + value) fields — `{ name, path, type, nullable }`. Turn it into `CREATE TABLE` DDL for any database in a few lines, so a fact store can be generated straight from what factlas ships and can't drift from the fact shape (see DOWNSTREAM.md §1).
  - **`schema/fact.schema.json` is now generated** rather than hand-maintained. It describes the same facts, but the file is regenerated from `fact.ts`: `schema_v` is pinned to the exact version (a `const`), and `$defs` are named after the types (e.g. `JsxElementFact`). Don't hand-edit it.

  The **fact shape and extractor output are unchanged** — no `FACT_SCHEMA_VERSION` bump; existing facts validate against the regenerated schema.

## 0.3.1

### Patch Changes

- 682081c: Update parsing/normalization dependencies to latest: `@babel/parser`,
  `@babel/traverse`, `@babel/types` 7 → 8; `postcss` 8.4 → 8.5; `culori` → 4.0.2.
  Fact output is unchanged (the golden determinism snapshot is byte-identical), but
  these versions are recorded in the snapshot header's `tool_versions`, so the
  `cache_key` changes and a cached consumer will re-extract once.

## 0.3.0

### Minor Changes

- aa81abf: Incremental content-hash caching. Extraction is pure, so a file whose bytes are
  unchanged — and whose determinism signature (schema/normalizer versions, plugin &
  tool versions, config hashes) still matches — can reuse its previously computed
  facts instead of being re-parsed. Output is byte-for-byte identical; only
  recomputation is skipped, and any version/config change invalidates the whole
  cache.

  - `@factlas/core`: `extractRepo` accepts an optional `cache`. New exports:
    `createDiskCache`, `runSignature`, `fileCacheKey`, `CACHE_FORMAT_VERSION`, and
    the `FileCache` / `FileCacheEntry` / `PersistentFileCache` types. Discovery now
    ignores `.factlas/`.
  - `@factlas/cli`: caches to `.factlas/cache.json` under the scanned directory by
    default; `--no-cache` disables it, and the run summary reports the hit ratio.
    Add `.factlas/` to `.gitignore`.

## 0.2.0

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

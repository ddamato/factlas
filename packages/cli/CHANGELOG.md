# @factlas/cli

## 0.1.0

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

### Patch Changes

- Updated dependencies [aa81abf]
  - @factlas/core@0.3.0
  - @factlas/plugin-css@3.0.0
  - @factlas/plugin-inline-style@3.0.0
  - @factlas/plugin-jsx@3.0.0
  - @factlas/plugin-styled@3.0.0
  - @factlas/plugin-tailwind@3.0.0

## 0.0.6

### Patch Changes

- Updated dependencies [9fe29c7]
  - @factlas/core@0.2.0
  - @factlas/plugin-inline-style@2.0.0
  - @factlas/plugin-css@2.0.0
  - @factlas/plugin-styled@2.0.0
  - @factlas/plugin-jsx@2.0.0
  - @factlas/plugin-tailwind@2.0.0

## 0.0.5

### Patch Changes

- Updated dependencies [c5d154e]
- Updated dependencies [fa1790c]
  - @factlas/core@0.1.0
  - @factlas/plugin-inline-style@1.0.0
  - @factlas/plugin-css@1.0.0
  - @factlas/plugin-jsx@1.0.0
  - @factlas/plugin-styled@1.0.0
  - @factlas/plugin-tailwind@1.0.0

## 0.0.4

### Patch Changes

- 1b8f911: Add a coverage summary: `factlas extract --stats` prints facts by
  kind/certainty/source plus the `unknown`/`dynamic` rate and per-reason
  diagnostics to stderr (stdout stays pure JSON). Exposes `coverageReport` and
  `formatCoverage` from the package for programmatic use.
- Updated dependencies [be75e71]
  - @factlas/core@0.0.2
  - @factlas/plugin-tailwind@0.0.2
  - @factlas/plugin-css@0.0.2
  - @factlas/plugin-inline-style@0.0.2
  - @factlas/plugin-jsx@0.0.2
  - @factlas/plugin-styled@0.0.2

## 0.0.3

### Patch Changes

- e2a589b: Read the CLI version from `package.json` at runtime so `factlas --version`
  always matches the published version (previously a hard-coded constant that could
  drift). Plugins now derive their producer version the same way.

## 0.0.2

### Patch Changes

- 1b1d500: Add `@factlas/plugin-jsx` to the default plugin set. It extracts the remaining
  fact kinds — `import`, `jsx.element`, `jsx.prop`, and `jsx.attribute` — with
  `element_id` linkage from each prop/attribute back to its owning element,
  completing the six-kind fact catalog. `factlas extract` now emits component
  usage, imports, and prop/attribute facts alongside the styling facts.

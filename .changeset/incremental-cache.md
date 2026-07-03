---
"@factlas/core": minor
"@factlas/cli": minor
---

Incremental content-hash caching. Extraction is pure, so a file whose bytes are
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

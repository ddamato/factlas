---
"@factlas/core": patch
---

Update parsing/normalization dependencies to latest: `@babel/parser`,
`@babel/traverse`, `@babel/types` 7 → 8; `postcss` 8.4 → 8.5; `culori` → 4.0.2.
Fact output is unchanged (the golden determinism snapshot is byte-identical), but
these versions are recorded in the snapshot header's `tool_versions`, so the
`cache_key` changes and a cached consumer will re-extract once.

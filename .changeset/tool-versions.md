---
"@factlas/core": patch
---

Populate the snapshot header's `tool_versions`. `extractRepo` now records the
resolved versions of factlas's parser/normalizer dependencies (`@babel/parser`,
`@babel/traverse`, `@babel/types`, `culori`, `postcss`, `postcss-value-parser`,
`fast-glob`) so a tool upgrade becomes a visible determinism input and changes the
run `cache_key`. Exposes `toolVersions()` and `TOOL_PACKAGES`; an explicit
`toolVersions` passed to `extractRepo`/`discover` still takes precedence.

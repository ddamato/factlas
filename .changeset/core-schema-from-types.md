---
"@factlas/core": minor
---

The schema artifacts are now **generated from the TypeScript types** (the single source of truth) via `npm run generate`, and a drift test keeps them in sync:

- **New export — `@factlas/core/schema/columns.json`:** a flat, DB-agnostic column manifest for the common (envelope + value) fields — `{ name, path, type, nullable }`. Turn it into `CREATE TABLE` DDL for any database in a few lines, so a fact store can be generated straight from what factlas ships and can't drift from the fact shape (see DOWNSTREAM.md §1).
- **`schema/fact.schema.json` is now generated** rather than hand-maintained. It describes the same facts, but the file is regenerated from `fact.ts`: `schema_v` is pinned to the exact version (a `const`), and `$defs` are named after the types (e.g. `JsxElementFact`). Don't hand-edit it.

The **fact shape and extractor output are unchanged** — no `FACT_SCHEMA_VERSION` bump; existing facts validate against the regenerated schema.

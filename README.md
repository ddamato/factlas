# factlas

**Deterministic design-system fact extraction.** Point it at a TypeScript/TSX +
CSS repository — locally or in CI — and get a typed, normalized,
content-addressed **stream of facts** about how the code uses colors, spacing,
components, and classes. Static analysis only: it never executes your code.

Factlas answers *"what does this code contain?"* deterministically. Deciding
whether that **conforms** to a design system (a store, policies, scoring, CI
gating) is deliberately **out of scope** — see
[docs/DOWNSTREAM.md](./docs/DOWNSTREAM.md) for the recommended architecture and
[`examples/evaluation`](./examples/evaluation) for a runnable reference of it
(guidelines → policies → SQLite → evalite → SARIF).

See [ADR-0001](./ADR.md) for the full design rationale and
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for build status.

## Quick start

Facts come out as **NDJSON — one fact per line** — so they load straight into a
database to be queried (which is the point: facts exist to be *evaluated*):

```bash
npx @factlas/cli extract ./src > facts.ndjson
```

```
{"fact_id":"1d52c98a…","kind":"css.declaration","file":"Button.css","certainty":"literal","source":"plain-css","subject":{"property":"color","selector":".btn","…":"…"},"value":{"raw":"#FFF","norm":"#ffffff","type":"color"}}
{"fact_id":"9af31b7e…","kind":"css.class","…":"…"}
```

Each line is a complete, content-addressed record — pipe it into SQLite/DuckDB/`jq`
with no unwrapping. Add `--json` (optionally `--pretty`) for the
`{ snapshot_header, facts }` object instead, when you want the header or a human read.

**Check on `norm`, display `raw`.** Because facts are content-addressed over the
*normalized* value, `#FFF` and `#ffffff` collapse to one fact, and an inline
`backgroundColor` and a stylesheet `background-color` describe the same property.

## Programmatic use

```ts
import { extractRepo } from '@factlas/core';
import jsx from '@factlas/plugin-jsx';
import css from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';

const { header, facts, diagnostics } = await extractRepo({
  root: './src',
  plugins: [jsx, css, inlineStyle, styled, tailwind],
});
```

## Packages

| Package | Role |
|---|---|
| [`@factlas/core`](./packages/core) | The fact layer: schema, determinism spine, parsing, plugin host, normalizers |
| [`@factlas/plugin-jsx`](./packages/plugin-jsx) | `import`, `jsx.element`, `jsx.prop`, `jsx.attribute` from TS/TSX |
| [`@factlas/plugin-css`](./packages/plugin-css) | `css.declaration` from PostCSS stylesheets / CSS Modules |
| [`@factlas/plugin-inline-style`](./packages/plugin-inline-style) | `css.declaration` from JSX `style={{}}` |
| [`@factlas/plugin-styled`](./packages/plugin-styled) | `css.declaration` from styled-components / emotion |
| [`@factlas/plugin-tailwind`](./packages/plugin-tailwind) | `css.class` from Tailwind `className` usage |
| [`@factlas/cli`](./packages/cli) | `factlas extract` — run on a repo, emit facts |

## Design guarantees

- **Deterministic.** Identical inputs produce byte-identical output; enforced by a
  golden-fixture snapshot test in CI (`@factlas/e2e`).
- **Static only.** Never executes repository code (ADR §2.4 rule 5).
- **Never drops.** Unresolved values become honest `dynamic`/`unknown` facts with
  a diagnostic reason — never a silent false negative.
- **Versioned.** `FACT_SCHEMA_VERSION` + `NORMALIZER_VERSION` are folded into the
  snapshot header; a change invalidates caches and signals a re-extract.

## Development

```bash
npm install
npm run build       # tsup, all packages
npm test            # vitest, incl. the golden-fixture determinism gate
npm run typecheck
npm run lint        # biome
```

Monorepo: npm workspaces + Turborepo, ESM-only, TypeScript, released with
Changesets under the `@factlas` scope.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the invariants, workflow, and PR
checklist. Changing the fact shape or a normalizer is a **migration** — follow
[docs/SCHEMA_MIGRATION.md](./docs/SCHEMA_MIGRATION.md).

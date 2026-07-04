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

See [Design](#design) below for the rationale, the core/plugin boundary, and the
determinism guarantees.

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

## Design

**Two-stage architecture.** Conformance reduces to deterministic predicates over a
*normalized model of the code (facts)*, not judgments over raw source — so the work
splits in two: **extract facts, then assert predicates.** This project is the first
stage; the second (store, policies, scoring, gating) is commodity and deliberately
downstream ([docs/DOWNSTREAM.md](./docs/DOWNSTREAM.md)). Two hard requirements shape
every decision:

- **Determinism over LLM judgment.** Checks must be cheap, reproducible, and
  explainable, so LLMs are excluded from the evaluation path entirely — allowed, if at
  all, only at *authoring* time (compiling policies) behind a deterministic gate.
- **Static analysis only.** The target's code is never executed; every fact comes from
  parsing source.

**Core owns the invariants; plugins own the technology.** [`@factlas/core`](./packages/core)
is the one place that can never fork: the Fact schema and versions, pipeline
orchestration, the determinism machinery (discovery, hashing, canonical JSON,
content-addressed `fact_id`), and **all normalization** (color / length / keyword /
property, plus the certainty decision tree). Plugins carry technology knowledge and
their heavy dependencies (Tailwind pulls in `tailwindcss`) and emit **raw observations
only — they never normalize.** Core produces every `value.norm`, `certainty`, and
`fact_id`, so those can't drift between extractors.

**Determinism guarantees:**

- **Byte-identical output** for identical inputs, enforced by a golden-fixture snapshot
  test in CI ([`@factlas/e2e`](./packages/e2e)). Sort everything; never rely on
  filesystem order, wall-clock, or locale.
- **Content-addressed `fact_id`** over the *normalized* value, so `#FFF` and `#ffffff`
  collapse to one fact.
- **Repo-relative POSIX paths only** — no absolute paths, timestamps, or environment
  values in a fact.
- **Versioned.** `FACT_SCHEMA_VERSION`, `NORMALIZER_VERSION`, tool/plugin versions, and
  config-file hashes fold into the snapshot header and the run cache key; a change
  invalidates caches and signals a re-extract.
- **Never executes code.** Anything past the bounded resolver (one binding hop, literals
  only, in-file, no `node_modules`, no evaluation) becomes `unknown`.
- **Never drops.** An unresolved value is an honest `dynamic`/`unknown` fact with a
  diagnostic reason — never a silent false negative.

**Certainty.** Every fact is `literal | static-union | dynamic | unknown`. Policies
judge `literal`/`static-union` directly; `dynamic`/`unknown` are never silently passed
or failed — a policy routes them explicitly (defer/review, or a gated check).

**Why not an existing tool:**

- **CodeQL** — best-in-class query language, but its license prohibits use against
  private/commercial repos in CI without paid GitHub Advanced Security. Legally
  unavailable for the target use.
- **Glean (Meta)** — the right model (facts + derived predicates), but a heavy
  operational burden and a query language (Angle) that LLMs author poorly. The store
  boundary is kept clean so Glean stays a future option.
- **Stylelint** — a *linter* (findings, not facts), PostCSS-only, and blind to
  TSX-embedded CSS (inline, CSS-in-JS, Tailwind). Usable as reference for rule logic,
  not as the extractor.

**Non-goals.** Aesthetic or semantic judgment ("does it look right"); runtime/computed
styling (cascade, theme switching, media-query outcomes); executing or bundling the
target repository.

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

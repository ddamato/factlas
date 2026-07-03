# @factlas/core

The deterministic **fact layer** for Factlas: a typed, normalized,
content-addressed, auditable stream of design-system facts extracted from
TypeScript/TSX and CSS by static analysis.

> Core is **not** a database and **not** a linter. It parses source once,
> dispatches to technology plugins, normalizes their raw observations with
> versioned algorithms, and assigns each fact a content-addressed `fact_id`.

See [ADR-0001](../../ADR.md) for the full design and
[IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) for build status.

## Status

**Phase 1 (contract & determinism spine) — complete.** Exposes:

- **The Fact contract** — `Fact` (discriminated union over all 6 kinds), the
  envelope/subject/value types, and `FACT_KINDS`.
- **Version anchors** — `FACT_SCHEMA_VERSION`, `NORMALIZER_VERSION`.
- **Determinism spine** — `canonicalStringify`/`sha256Hex`, content-addressed
  `computeFactId`/`factify`, and `discover` (file discovery + hashing + the
  snapshot header with a `cache_key`).
- **Published JSON Schema** — `@factlas/core/schema/fact.schema.json`.

```ts
import {
  discover,
  factify,
  FACT_SCHEMA_VERSION,
  type Fact,
} from '@factlas/core';

const { files, header } = await discover({ root: process.cwd() });
// header.cache_key changes whenever any determinism input changes
```

**Phase 2 (parsing & plugin host) — complete.** Adds:

- **Base parsers** — `parseModule` (TS/TSX → Babel AST, parsed once) and
  `parseStylesheet` (CSS → PostCSS root), plus `traverse` re-exported so plugins
  never depend on Babel directly, and `babelLoc`/`postcssLoc` converters.
- **The plugin contract** — `DesignFactsPlugin` (`analyzeCss` / `analyzeProgram`),
  `PluginContext` (injects `tokenize`, `resolve`, `parseCss`, `emit`,
  `diagnostic`), and the `Observation` shape plugins emit (raw only — core owns
  normalization + `fact_id`).
- **Bounded resolver** — `resolveExpression`: one hop, literals only, no
  cross-file/`node_modules`, no execution; degrades to honest `dynamic`/`unknown`.
- **The extraction router** — `extractFile` routes by extension, lifts CSS
  carriers back into the CSS path via `ctx.parseCss`, and turns parse failures or
  throwing plugins into diagnostics rather than crashes.

```ts
import { extractFile, type DesignFactsPlugin } from '@factlas/core';

const { observations, diagnostics } = extractFile({ file, code, plugins });
```

**Phase 3 (normalization & assembly) — complete.** Adds:

- **Versioned normalizers** (pure, gated by `NORMALIZER_VERSION`): `normalizeColor`
  (culori → canonical hex), `normalizeLength`, `normalizeKeyword`,
  `normalizeProperty` (camelCase/vendor-prefix → kebab), and the `normalizeValue`
  dispatcher — the single function facts and allowed-sets must share.
- **`classifyCertainty`** — the certainty decision tree (`literal | static-union |
  dynamic | unknown`).
- **`assembleFact` / `assembleFacts`** — turn a raw observation into a finalized,
  content-addressed `Fact`: classify → normalize → canonicalize subject →
  `factify`, enforcing the invariants (dynamic/unknown ⇒ `norm: null` + a
  diagnostic; an unnormalizable literal degrades to an honest `unknown`, never a
  silent drop). `sortFacts` gives deterministic output ordering.

```ts
import { extractFile, assembleFacts, sortFacts } from '@factlas/core';

const extracted = extractFile({ file, code, plugins });
const facts = assembleFacts(extracted); // normalized, sorted Facts
```

**Phase 4 (default plugins) — complete.** The four plugins now extract real
facts end-to-end, verified by a golden-fixture byte-stability test:

- [`@factlas/plugin-css`](../plugin-css) — `css.declaration` from stylesheets.
- [`@factlas/plugin-inline-style`](../plugin-inline-style) — `css.declaration`
  (source `inline`) from `style={{}}`.
- [`@factlas/plugin-styled`](../plugin-styled) — `css.declaration` (source
  `css-in-js`) from styled-components / emotion.
- [`@factlas/plugin-tailwind`](../plugin-tailwind) — `css.class` from Tailwind
  `className` usage (`cn`/`clsx`/`cva`, arbitrary values).

```ts
import { extractFile, assembleFacts, sortFacts } from '@factlas/core';
import css from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';

const plugins = [css, inlineStyle, styled, tailwind];
const facts = assembleFacts(extractFile({ file, code, plugins }));
```

**Phase 5 (repo orchestration) — complete.** `extractRepo({ root, plugins })`
runs the whole fact layer over a repository (discover → extract → assemble →
globally-sorted facts) and is what [`@factlas/cli`](../cli) wraps:

```ts
import { extractRepo } from '@factlas/core';

const { header, facts, diagnostics } = await extractRepo({ root: './src', plugins });
```

**The in-scope project (the fact layer) is complete.** Evaluation — store,
policies, scoring, SARIF, gating — is intentionally downstream; see
[docs/DOWNSTREAM.md](../../docs/DOWNSTREAM.md).

## Install

```
npm install @factlas/core
```

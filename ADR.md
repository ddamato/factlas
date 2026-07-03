# ADR-0001: Factlas — Deterministic Design-System Fact Extraction & Conformance Evaluation

- **Status:** Accepted
- **Date:** 2025-06-01
- **Deciders:** (project owner)
- **Audience:** Implementing engineer / coding agent
- **Supersedes / Superseded by:** —

---

## 1. Context

We are building a system that evaluates whether a codebase conforms to an
organization's design-system expectations (design tokens, component usage,
styling guidelines), and gates releases on the result.

Two hard requirements shape every decision in this ADR:

1. **Determinism over LLM judgment.** Conformance checks must be cheap,
   reproducible, and explainable. LLMs are expensive and non-deterministic, so
   they are **excluded from the evaluation-time path**. LLMs may be used only at
   *authoring time* to compile policies, and their output must pass a
   deterministic validation gate before use.
2. **Static analysis only.** Never execute repository code. All facts are
   derived by parsing source statically.

**Core insight:** conformance reduces to deterministic predicates over a
*normalized model of the code (facts)*, not to judgments over raw source. This
yields a two-stage architecture — **extract facts, then assert predicates** —
where the novel, defensible work is the extraction+normalization layer, and
everything downstream (querying, scoring, reporting) is commodity.

**Target repositories:** TypeScript + TSX (React). CSS is applied via **various**
methods (CSS Modules / plain CSS, inline `style`, CSS-in-JS, Tailwind), so the
CSS extractor must converge all of them into one fact shape. The tooling must
run locally and in CI/CD with **no persistent services**.

### Alternatives considered and rejected

- **Glean (Meta):** correct model (facts + derived predicates) but heavy
  operational burden and a thin-corpus query language (Angle) that LLMs author
  poorly. Deferred; we preserve the store boundary so Glean remains a future
  option.
- **CodeQL:** best-in-class query language, but its license (verified) prohibits
  use against non-open-source codebases in CI/CD without a paid GitHub Advanced
  Security license. **Legally unavailable** for our commercial, internal,
  private-repo use. Rejected.
- **Stylelint as the extractor:** it is a *linter* (produces findings, not
  facts), its engine is just PostCSS, and it cannot see TSX-embedded CSS
  (inline / CSS-in-JS / Tailwind). Rejected as an extractor; its rule logic may
  be mined as reference only.

---

## 2. Decision

Build **Factlas**, with a hard boundary between a **novel core fact layer** and
**commodity consumers**. (Project name is a constant; the agent may rename via a
single exported identifier.)

### 2.1 Architecture

```

AUTHORING TIME (occasional, per release, LLM-assisted, human-approved):
tokens (DTCG) + component .d.ts + guidelines
→ LLM Policy Compiler → Policy Bundle (predicates + allowed-sets)
→ deterministic validation gate → signed, versioned bundle artifact

EVAL TIME (per PR/commit, 100% deterministic, offline):
repo → [FACT LAYER] → facts → load into store → run policy SQL
→ violations → evalite scores → SARIF → CI gate

````

The **fact layer** (extraction + normalization) is the project's core IP and the
primary focus of this ADR. Consumers (store, policies, evalite, SARIF, LLM
compiler) depend on the fact layer but are separate and thinner.

### 2.2 The fact layer is a standalone, plugin-based package

Package: **`@factlas/core`**. Its *product is a typed, normalized,
content-addressed, auditable stream of facts* — **not** a database, not a
linter. It has **no dependency** on any store, on SARIF, on evalite, or on
technology-specific styling libraries (e.g. `tailwindcss`).

**Core owns (invariants that must never fork):**

- The **Fact schema** and `FACT_SCHEMA_VERSION`.
- **Pipeline orchestration**: discovery → parse → dispatch to plugins →
  normalize → factify → assemble result.
- **Determinism machinery**: file discovery, content hashing, the snapshot
  header, canonical JSON serialization, and **content-addressed `fact_id`
  assignment**.
- **Normalization**: the shared, versioned algorithms (color via `culori`,
  length, keyword, CSS property-name canonicalization) **plus the certainty
  decision tree**. `NORMALIZER_VERSION` lives here. **Plugins must never
  normalize.**
- **Base parsing**: `@babel/parser` / `@babel/traverse` (TSX) and `postcss`
  (CSS). Core parses **once** and hands plugins the AST.
- The **plugin host** and injected utilities: value tokenizer
  (`postcss-value-parser`), the bounded resolver, and the diagnostics emitter.

**Plugins own (technology knowledge + their own heavy deps):**

- `@factlas/plugin-css` — PostCSS stylesheets / CSS Modules (default).
- `@factlas/plugin-inline-style` — `style={{}}` objects (default).
- `@factlas/plugin-styled` — styled-components / emotion tagged templates.
- `@factlas/plugin-tailwind` — depends on `tailwindcss`; resolves classes →
  declarations. **Optional; not installed unless the repo uses Tailwind.**

Plugins emit **raw observations** only. They classify value *type* and provide
*certainty hints*; core produces the final `value.norm`, final `certainty`, and
the `fact_id`. Each plugin declares a `version` that is folded into the snapshot
header (a plugin upgrade must invalidate caches).

### 2.3 The Fact shape (the contract everything binds to)

**Envelope (present on every fact):**

| field        | meaning |
|--------------|---------|
| `fact_id`    | sha256 of canonical `{kind, file, loc, subject, value.norm}` |
| `kind`       | fact type; the join key to policies |
| `schema_v`   | `FACT_SCHEMA_VERSION` |
| `file`       | repo-relative, POSIX-normalized path |
| `loc`        | `{ line, col, endLine, endCol }` |
| `source`     | `plain-css \| css-module \| inline \| css-in-js \| tailwind \| babel-jsx` |
| `producer_v` | plugin name + version that emitted it |
| `certainty`  | `literal \| static-union \| dynamic \| unknown` |

**Value (when present):** `{ raw, norm, type }` where
`type ∈ color | length | number | keyword | string | url | shadow | module | dynamic | union`.
**Check on `norm`; display `raw`.** `norm` is `null` for `dynamic`/`unknown`.

**Fact kinds (v1 catalog):**

| kind              | subject                                        | value            | powers |
|-------------------|------------------------------------------------|------------------|--------|
| `jsx.element`     | name, imported_from, is_dom                    | —                | required/forbidden components |
| `jsx.prop`        | component, prop, element_id                    | {raw,norm,type}  | prop enums, required props |
| `jsx.attribute`   | owner, attribute, element_id                   | {raw,norm,type}  | no-inline-style, forbidden attrs |
| `import`          | specifier, local, import_kind                  | module           | allowed packages; resolution backbone |
| `css.declaration` | property, selector, media, owner_component     | {raw,norm,type}  | token conformance (color/spacing/radius) |
| `css.class`       | token, utility, is_arbitrary, element_id       | {raw,norm,type}  | no-arbitrary values, known classes |

`element_id` is a foreign key to the owning `jsx.element` fact, enabling shallow
compositional queries (e.g. "a `Button` from `@acme/ui` that also has an inline
`style`") via a simple join.

### 2.4 Determinism rules (non-negotiable)

1. Sort file lists and final fact output deterministically; **never** rely on
   filesystem order or `Promise.all` resolution order.
2. Repo-relative, POSIX paths only. **No** absolute paths, timestamps, locale, or
   environment values in facts.
3. `fact_id` is content-addressed over the **normalized** value (so `#FFF` and
   `#ffffff` collapse to one fact).
4. Pin parser/tool versions. Fold `toolVersions`, `NORMALIZER_VERSION`, plugin
   versions, and hashes of relevant config files (e.g. `tailwind.config`,
   `postcss.config`) into the **snapshot header** and the run cache key. A config
   change must invalidate caches.
5. **Never `eval` or execute repo code.** Anything beyond the **bounded
   resolution budget** (one hop; literals only; no descent into `node_modules`;
   no function evaluation) → `unknown`.
6. **Never drop unresolved values.** Emit `dynamic`/`unknown` facts **with a
   diagnostic reason**. Dropping = silent false negative = forbidden.
7. Facts and reference/allowed-set tables must be normalized by the **same
   versioned normalization function**.

### 2.5 Certainty handling

- `literal` → judged directly by policy.
- `static-union` (e.g. `variant={ok ? 'a' : 'b'}`, conditional Tailwind classes)
  → judged; **all** members must be legal.
- `dynamic` / `unknown` → routed by each policy's `certaintyPolicy` to *defer*
  (informational) or to an explicitly-gated Tier-2 LLM suite. **Never silently
  pass or fail.**

### 2.6 Consumers (separate, thinner — build after the core)

- **Store:** DuckDB (embedded; SQLite fallback). Table-per-kind plus a union
  view. Attaches a **versioned reference DB** (allowed-sets from DTCG tokens via
  Style Dictionary; component prop specs mined from `.d.ts` via `ts-morph`).
  Idempotent upsert by `fact_id`; per-file incremental via content hash.
- **Policies:** a Policy Bundle is versioned/signed **data** — metadata plus
  parameterized SQL that **selects violation rows** (zero rows = pass). Rule
  *types* map to parameterized SQL templates. Bundles are semver'd, signed, and
  stored in a registry; a repo pins the bundle version it is evaluated against.
- **Scoring:** evalite (Vitest). Deterministic scorer per policy:
  `violations.length === 0 ? 1 : 0`. Gate aggregation: all `error`-severity
  policies must score 1.
- **Reporting:** emit SARIF; CI gate exits non-zero on any `error`-severity
  violation.
- **LLM Policy Compiler (authoring-time only):** classify guidelines
  (compilable vs semantic-only) → generate predicates as schema-constrained JSON
  against the fixed rule-type catalog → generate per-predicate positive/negative
  fixtures → **deterministic gate** rejects any predicate that fails its own
  fixtures or references unknown fact kinds/columns → human review before
  promotion. This component must never run at eval time.

---

## 3. Implementation plan (build order)

Build the **core fact layer first and completely** — it is the dependency root and the hardest part to change later.

**Phase 1 — Core contract & determinism spine**
1. `@factlas/core`: define Fact types (envelope + all 6 kinds),
   `FACT_SCHEMA_VERSION`, `NORMALIZER_VERSION`. Publish a JSON Schema for the
   Fact shape.
2. `discover.ts`: `fast-glob` + `node:crypto` sha256 per file; POSIX-relative
   paths; sorted; snapshot header folding tool/normalizer/plugin versions +
   config-file hashes.
3. `factify.ts`: content-addressed `fact_id` via canonical JSON (sorted keys,
   fixed number/locale formatting).

**Phase 2 — Parsing & plugin host**
4. Base parsers: Babel (TSX) → AST; PostCSS (CSS) → root. Parse once; expose to
   plugins.
5. Plugin host + `DesignFactsPlugin` interface + `PluginContext` (inject
   tokenizer, bounded resolver, diagnostics). Fold each plugin `version` into the
   snapshot header.
6. `extractFile` router by extension; the TSX path additionally lifts CSS
   carriers (inline objects, styled templates, className strings) and routes them
   to plugins / the CSS path.

**Phase 3 — Normalization (highest test investment)**
7. `classify.ts`: certainty decision tree consuming `valueNodeType` +
   `__dynamic` hints → `literal | static-union | dynamic | unknown`.
8. Normalizers, all pure and versioned by `NORMALIZER_VERSION`:
   - `normalize/color.ts` (culori) — canonical hex; `#abc`→`#aabbcc`;
     `rgb()`/`hsl()`→hex.
   - `normalize/length.ts` — unit handling; `0`→`0px` per property; optional
     `rem`→`px` at a fixed root size.
   - `normalize/keyword.ts` — casing/alias canonicalization.
   - `normalize/property.ts` — camelCase→kebab, including vendor-prefix rules
     (`WebkitX`→`-webkit-x`) and pass-through for `--custom-properties`.
9. Enforce invariants: a value containing a dynamic placeholder is
   `certainty:dynamic`, `value.norm:null`, and is **never** compared to an
   allowed-set. Every `unknown`/`dynamic` fact carries a diagnostic reason.

**Phase 4 — Default plugins**
10. `@factlas/plugin-css`, `@factlas/plugin-inline-style` (bundled defaults).
11. `@factlas/plugin-styled` (import-aware tag recognition; positional
    interpolation handling per §2.4/§2.5).
12. `@factlas/plugin-tailwind` (separate package; depends on `tailwindcss`;
    resolves classes → declarations; flags arbitrary values; recognizes
    configurable class-combiners such as `cn`/`clsx`/`cva`, extracting literal
    class tokens even from conditional expressions as `static-union`).

**Phase 5 — Consumers (only after the core is proven)**
13. `@factlas/store-duckdb`: DDL (table-per-kind + union view), idempotent upsert
    by `fact_id`, per-file incremental cache keyed on content hash.
14. `@factlas/reference`: token ETL (Style Dictionary/DTCG → `ref_allowed_*`) and
    component-API ETL (`ts-morph` over `.d.ts` → `ref_component_prop_spec`), using
    the **same** normalization function as the fact layer.
15. `@factlas/policy`: Policy Bundle JSON Schema, `zod`/`ajv` validation,
    rule-type → SQL emitter, and the violation-query runner.
16. `@factlas/report`: violations → SARIF.
17. evalite suites: `tier1.eval.ts` (deterministic scorers over facts) and a
    gated `tier2.eval.ts` (LLM scorers for semantic-only guidelines).
18. `@factlas/cli`: `factlas extract`, `factlas evaluate`, `factlas compile-policy`.

**Phase 6 — LLM Policy Compiler (authoring-time)**
19. Guideline classifier, schema-constrained predicate generator, per-predicate
    fixture generator, and the deterministic validation gate. Human review before
    a bundle is promoted.

---

## 4. Testing & quality requirements

- **Golden-fixture determinism test (headline guarantee):** a `fixtures/`
  sample repo with a checked-in `__snapshots__/` of expected facts. Assert
  **byte-stable** output for a fixed snapshot header. This test *is* the core
  promise; it runs in CI.
- **Per-predicate self-tests:** every LLM-authored predicate ships positive and
  negative fixtures; the gate rejects any that fail.
- **`unknown`/`dynamic`-rate metrics:** the fact layer emits per-file, per-kind,
  per-reason diagnostics so coverage can be measured on real repos. This metric
  drives all "deepen resolution later" decisions.
- **Normalizer version discipline:** any change to a normalizer bumps
  `NORMALIZER_VERSION` and is treated as a migration (full re-extract).

---

## 5. Consequences

**Positive**
- The novel, defensible work (facts + normalization) is isolated, versioned, and
  heavily tested; everything else is thin and replaceable.
- Runs anywhere Node runs, offline, as a start-and-exit process (linter-like
  ergonomics); no service to operate.
- The store is swappable behind a `FactStore` seam, so a future migration to
  Glean/Angle is bounded (port SQL→Angle, swap store) and non-blocking now.
- LLM cost/non-determinism is confined to authoring time behind a deterministic
  gate.
- Plugin system means technologies like Tailwind are optional and never shipped
  in core.

**Negative / risks**
- Cold-run parse time on large monorepos (mitigated by content-hash incremental
  caching and changed-files-only PR runs; deep `ts-morph` resolution is opt-in).
- Determinism depends on **discipline** (pinning, path/locale normalization,
  version folding) — enforced by the golden-fixture test, not by the runtime.
- CSS-in-JS is the most fragile extractor; unresolved cases must degrade to
  honest `unknown` facts, never silent drops.
- One non-pure-JS dependency (DuckDB native binary) to verify per CI platform;
  SQLite is the fallback.

**Neutral**
- The Fact schema is the highest-cost artifact to change; a JSON Schema + schema
  version + migration story are mandatory from day one.

---

## 6. Non-goals

- Aesthetic/semantic judgment ("does it look right"). Factlas measures
  *compliance with approved primitives*, not visual quality.
- Runtime/computed styling (cascade resolution, theme switching at runtime,
  media-query outcomes). Static analysis only.
- Executing or bundling the target repository.


# Factlas — Implementation Plan

Derived from [ADR-0001](./ADR.md). This project builds **only the fact layer** —
deterministic extraction + normalization producing a typed, content-addressed
stream of facts. Everything downstream (store, policies, scoring, reporting, LLM
policy compiler) is **explicitly out of scope**; it is documented as
recommendations in [docs/DOWNSTREAM.md](./docs/DOWNSTREAM.md).

## Scope boundary

**In scope — the fact layer:**
- `@factlas/core` — Fact schema, determinism spine, parsing, plugin host,
  normalizers.
- `@factlas/plugin-css`, `@factlas/plugin-inline-style`,
  `@factlas/plugin-styled`, `@factlas/plugin-tailwind` — technology extractors.
- `@factlas/cli` — a **thin `factlas extract`** command that emits the normalized
  fact stream (+ snapshot header) to JSON/stdout. Extraction only; no
  `evaluate`, no `compile-policy`.

**Out of scope (documented, not built) — see docs/DOWNSTREAM.md:**
- Store (DuckDB/SQLite), `@factlas/reference` (DTCG token + `.d.ts` ETL),
  policy bundles + SQL predicates, evalite scoring, SARIF reporting, CI gating,
  and the authoring-time LLM policy compiler.

The project preserves the seams (stable Fact schema + JSON Schema, deterministic
`fact_id`) so a downstream system can consume facts without this project taking
on that responsibility.

## Decisions (locked)

| Area | Choice | Notes |
|------|--------|-------|
| Repo structure | **npm workspaces + Turborepo** monorepo | |
| Module format | **ESM-only**, bundled with **tsup** | `"type": "module"` |
| Language | **TypeScript** (strict) | `.d.ts` emitted per package |
| Test runner | **Vitest** | Golden-fixture snapshot tests are the headline guarantee |
| npm naming | **Scoped** under `@factlas` (org created) | each package: `publishConfig.access = "public"` |
| Node target | **Node 20+ LTS** | |
| Release/versioning | **Changesets** | independent semver per package |
| Lint/format | **Biome** | |
| CI publish token | GitHub secret **`NPM_TOKEN`** (set) | |

## Monorepo layout

```
factlas/
  package.json              # workspace root (private, not published)
  turbo.json                # pipeline: build, test, lint, typecheck
  tsconfig.base.json        # shared strict TS config
  biome.json                # lint + format
  .changeset/               # release management
  .github/workflows/        # ci.yml + release.yml
  docs/DOWNSTREAM.md        # recommended (out-of-scope) evaluation system
  packages/
    core/                   # @factlas/core          (Phases 1–3)
    plugin-css/             # @factlas/plugin-css     (Phase 4, default)
    plugin-inline-style/    # @factlas/plugin-inline-style (Phase 4, default)
    plugin-styled/          # @factlas/plugin-styled  (Phase 4)
    plugin-tailwind/        # @factlas/plugin-tailwind(Phase 4, optional tailwindcss dep)
    cli/                    # @factlas/cli            (thin `extract`)
  fixtures/                 # sample repo for golden determinism tests
```

## Dependency ownership (ADR §2.2)

- **core**: `@babel/parser`, `@babel/traverse`, `postcss`, `postcss-value-parser`,
  `culori`, `fast-glob`, `node:crypto`. No store/SARIF/tailwind deps.
- **plugin-tailwind**: `tailwindcss` (only place it appears).
- **cli**: depends on `@factlas/core` + the default plugins; no eval deps.

## Phase 0 — Scaffold ✅ (done)

Root workspace, Turbo pipeline, strict tsconfig, Biome, Changesets, CI + release
workflows, and the `@factlas/core` skeleton (builds/typechecks/tests/lints green).

## Phase 1 — Core contract & determinism spine  (`@factlas/core`)

1. `src/fact.ts`: Fact envelope + all 6 kind subject/value types;
   `FACT_SCHEMA_VERSION`, `NORMALIZER_VERSION` (constants already seeded).
2. `schema/fact.schema.json`: published JSON Schema for the Fact shape.
3. `src/discover.ts`: `fast-glob` discovery, `node:crypto` sha256 per file,
   POSIX-relative sorted paths, snapshot header (tool/normalizer/plugin versions +
   config-file hashes).
4. `src/factify.ts`: canonical JSON (sorted keys, fixed number/locale formatting)
   → content-addressed `fact_id`.

## Phase 2 — Parsing & plugin host  (`@factlas/core`)

5. `src/parse/`: Babel (TSX) → AST and PostCSS (CSS) → root. Parse **once**.
6. `src/plugin/`: `DesignFactsPlugin` interface + `PluginContext` (inject
   tokenizer, bounded resolver, diagnostics); plugin host; fold plugin `version`
   into the snapshot header.
7. `src/extract/extractFile.ts`: router by extension; TSX path lifts CSS carriers
   (inline objects, styled templates, className strings) to plugins/CSS path.

## Phase 3 — Normalization (highest test investment)  (`@factlas/core`)

8. `src/classify.ts`: certainty decision tree → `literal | static-union | dynamic
   | unknown`.
9. `src/normalize/`: pure, `NORMALIZER_VERSION`-gated — `color.ts` (culori),
   `length.ts`, `keyword.ts`, `property.ts`.
10. Invariant enforcement: dynamic placeholder ⇒ `certainty:dynamic`,
    `norm:null`, never compared to an allowed-set; every `unknown`/`dynamic` fact
    carries a diagnostic reason.
11. `assemble.ts`: observation → normalized `Fact` (classify → normalize →
    canonicalize subject → factify), plus `sortFacts` for deterministic output.

> Note: the **golden-fixture byte-stability test** runs over the real default
> plugins, so it is stood up in Phase 4 (once `plugin-css`/`plugin-inline-style`
> exist). Phase 3 ships exhaustive normalizer/classify/assemble unit tests and an
> assemble-determinism check in their place.

## Phase 4 — Plugins ✅ (done)

12. `@factlas/plugin-css`, `@factlas/plugin-inline-style` (bundled defaults). ✅
13. `@factlas/plugin-styled` (import-aware tag recognition; interpolations →
    `dynamic` per ADR §2.4/§2.5). ✅
14. `@factlas/plugin-tailwind` (separate package; extracts `css.class` with
    utility/arbitrary parsing; recognizes `cn`/`clsx`/`cva`/`twMerge`;
    conditional classes → `static-union`). ✅
15. `@factlas/e2e` (private): golden-fixture byte-stability test over a sample
    repo exercising all four plugins + a two-run equality check. ✅

> Tailwind v1 extracts and structures class usage; full class→declaration
> resolution via the Tailwind engine is deferred (documented in the package).
> `tailwindcss` is an optional peer; config hashing flows through
> `discover({ configFiles })`.

## Phase 5 — Thin CLI  (`@factlas/cli`) ✅ (done)

16. Core `extractRepo(options)`: the reusable repo-level orchestration
    (discover → extract → assemble → globally-sorted facts), plugins injected. ✅
17. `factlas extract <path> [--out] [--config] [--include] [--exclude] [--pretty]`:
    emits `{ snapshot_header, facts }` as canonical JSON to stdout (summary to
    stderr). Exit 0 on success. **No** evaluation, gating, policy, or store —
    `--help` notes scoring/gating is a downstream concern (docs/DOWNSTREAM.md). ✅

---

## Status: project scope complete

All in-scope phases (1–5) are built, tested, and green: the fact layer
(`@factlas/core`), the four plugins, and the `factlas extract` CLI. Determinism
is guarded by the golden-fixture byte-stability test. Remaining work is the
out-of-scope downstream system (docs/DOWNSTREAM.md) and pre-publish tasks
(npm org is set; `NPM_TOKEN` secret is set; run `changeset` to cut versions).

## Testing & quality gates (ADR §4)

- Golden-fixture byte-stability test (CI headline gate).
- `unknown`/`dynamic`-rate diagnostics (per file/kind/reason) for coverage.
- Normalizer-version discipline: any normalizer change bumps `NORMALIZER_VERSION`
  and is treated as a migration (full re-extract).

## Publishable milestones

- **M1** — Phase 1: `@factlas/core` publishes Fact schema + JSON Schema +
  determinism spine. Alpha.
- **M2** — Phases 2–4 (css + inline-style): core emits real facts from TSX/CSS;
  golden-fixture test green. First genuinely useful release.
- **M3** — Phase 4 complete (styled + tailwind).
- **M4** — Phase 5: `factlas extract` CLI. Project scope complete.

## Open items / risks (ADR §5)

- CSS-in-JS is the most fragile extractor — must degrade to honest `unknown`,
  never silent drops.
- Determinism relies on discipline (pinning, path/locale normalization, version
  folding); enforced by the golden-fixture test, not the runtime.

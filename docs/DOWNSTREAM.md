# Downstream evaluation system (recommendations — out of scope)

Factlas is deliberately scoped to the **fact layer**: point it at a repository
(locally or in CI) and it emits a deterministic, content-addressed stream of
normalized facts. It does **not** decide whether a repo *conforms* to a design
system — no database, no policies, no scoring, no gating, no reporting.

This document records the **recommended** downstream architecture so a consuming
team can build (or buy) evaluation on top of the facts. None of it is a
responsibility of this project; it exists so the seams we expose stay useful.

> 🏃 **A runnable reference of everything below lives in
> [`examples/evaluation`](../examples/evaluation)** — store (SQLite), a SQL policy
> bundle whose predicates run straight over the facts, SARIF, and a CI gate,
> evaluated against `examples/app` with off-the-shelf tech. Read on for the
> rationale; open that package to see it work.

> Source of truth for the original full-system design is [ADR-0001](../ADR.md)
> §2.6 and §3 (Phases 5–6). This file summarizes and marks the boundary.

## The seam we guarantee

A downstream consumer binds to three stable things this project owns:

1. **The Fact shape** — envelope + 6 kinds (ADR §2.3), published as a versioned
   JSON Schema (`@factlas/core` → `schema/fact.schema.json`) and gated by
   `FACT_SCHEMA_VERSION`.
2. **Deterministic `fact_id`** — content-addressed over the *normalized* value,
   so the same declaration always yields the same id (idempotent upserts).
3. **`NORMALIZER_VERSION`** — normalization is versioned; a bump is a migration
   signal (re-extract, don't compare across versions).

As long as a consumer reads facts through this contract, everything below is
swappable and non-blocking.

```
[ THIS PROJECT — fact layer ]            [ DOWNSTREAM — not built here ]
repo → factlas extract → facts.ndjson →  load into store
                                          → run policy predicates
                                          → violations
                                          → scores / SARIF / CI gate
```

## Recommended components

- **Store facts verbatim, don't reshape them.** `factlas extract` emits NDJSON —
  one fact per line — precisely so it drops into a database with no transformation.
  The runnable reference keeps a single `facts` table with the fact stored as JSON
  and the common fields exposed as *generated columns* (declarative `json->>` paths,
  indexed); kind-specific subject fields are read with `json->>'$.subject.…'` in a
  policy. Nothing mirrors the Fact types, so the store never changes when the schema
  evolves. **SQLite** (`better-sqlite3`) here; **DuckDB** (`read_json`) is a natural
  swap for columnar/analytical queries over large fact sets.
- Idempotent upsert keyed on `fact_id`; per-file incremental via content hash
  from the snapshot header.
- Keep the store swappable (e.g. a future move to Meta's Glean/Angle is a bounded
  port: SQL → Angle).

### 2. Reference data — prefer none
- **Most conformance checks need no reference data.** Whether a value is *hardcoded*
  is intrinsic to the fact (its `certainty`/`value_type`), so "don't hardcode a
  color — use a token" is a predicate over facts alone. Compare facts straight to
  policy; don't stand up an allowed-set ETL to massage token data in between. The
  runnable reference has **no reference layer at all** for exactly this reason.
- **When a check genuinely needs external data** (e.g. an allow-list of approved
  packages, or component-prop specs mined from `.d.ts`), keep that data **inside the
  policy** (inline JSON queried with SQLite's `json_each`), not a separate
  preprocessing step — the policy stays a self-contained, versioned artifact.
- **If you must compare against normalized values**, reuse the normalizers from
  `@factlas/core` rather than reimplementing them, or the two sides drift
  (`#3366FF` ≠ `#3366ff`). Needing this at all is a sign the check could likely be
  reframed as a fact-intrinsic predicate instead.

### 3. Policies
- A Policy Bundle is versioned, signed **data**: metadata + parameterized SQL
  that *selects violation rows* (zero rows = pass).
- Rule *types* map to parameterized SQL templates; a repo pins the bundle
  version it is evaluated against.
- Decide how each policy treats `dynamic`/`unknown` facts **explicitly**, never
  silently. The runnable reference does this by scoping value policies to
  `certainty = 'literal'` and routing everything unresolved into a dedicated
  `needs-review` policy (surfaced as a SARIF `note` for a human, or a gated
  Tier-2 LLM suite).

### 4. Scoring & reporting
- evalite (Vitest) deterministic scorer per policy:
  `violations.length === 0 ? 1 : 0`.
- Emit **SARIF**; CI gate exits non-zero on any `error`-severity violation.

### 5. Authoring-time LLM policy compiler (never runs at eval time)
- Classify guidelines (compilable vs semantic-only) → generate predicates as
  schema-constrained JSON against the fixed rule-type catalog → generate
  per-predicate positive/negative fixtures → **deterministic validation gate**
  rejects any predicate that fails its own fixtures or references unknown fact
  kinds/columns → human review before a bundle is promoted.

## How to consume the fact stream

```
# In CI or locally:
factlas extract ./ --out facts.ndjson   # NDJSON: one fact per line

# Downstream (your system):
#   1. load facts.ndjson into the store verbatim (one row per line, upsert by fact_id)
#   2. run the pinned policy bundle's SQL over the facts → violation rows
#   3. score → SARIF → gate the PR
```

The fact stream is stable and deterministic, so steps 1–3 can be re-run,
cached, and diffed independently of extraction.

## Why this split

- The novel, defensible work (facts + normalization) is isolated, versioned, and
  heavily tested; evaluation is commodity and replaceable.
- Extraction runs anywhere Node runs, offline, start-and-exit — no service to
  operate.
- LLM cost/non-determinism, if used at all, is confined to *authoring* time
  behind a deterministic gate, never the eval path.

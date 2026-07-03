# @factlas/example-evaluation

A **runnable reference** for the downstream evaluation pipeline described in
[docs/DOWNSTREAM.md](../../docs/DOWNSTREAM.md): take a factlas fact stream and turn
it into a design-system conformance verdict — **store → allowed-sets → policies →
SARIF → CI gate**.

> ⚠️ **Demonstration only.** This is *not* part of the shipped factlas project and
> is never published. Factlas owns the fact layer; everything here is the kind of
> thing a consuming team would build (or buy) on top of it, shown with ordinary
> off-the-shelf tech so the seams are concrete. It's a private workspace package
> purely so CI keeps it working.

## The pipeline

```
factlas extract examples/app --out facts.json     # the seam factlas owns
        │
        ▼   this package
   load facts.json ──▶ SQLite (sql.js): one table per kind + a `facts` view
   tokens.json ──[@factlas/core normalizers]──▶ ref_allowed_colors / _lengths
   policy bundle (policies/*.sql) ──▶ violation rows
   violations ──▶ SARIF 2.1.0  +  pass/fail gate (non-zero exit on error)
```

Each stage maps 1:1 to a section of `DOWNSTREAM.md`:

| Stage | File(s) | DOWNSTREAM.md |
|---|---|---|
| Store | [`src/store.ts`](./src/store.ts) — SQLite via `sql.js` | §1 |
| Allowed-sets | [`src/reference.ts`](./src/reference.ts) + [`reference/tokens.json`](./reference/tokens.json) | §2 |
| Policies | [`policies/`](./policies) (`bundle.json` + `*.sql`) | §3 |
| Score & SARIF | [`src/evaluate.ts`](./src/evaluate.ts), [`src/sarif.ts`](./src/sarif.ts) | §4 |

## Run it

```bash
# 1. Extract facts from the sample app (the part factlas actually does)
npx @factlas/cli extract examples/app --out facts.json

# 2. Evaluate them (this package). SARIF → stdout, summary → stderr,
#    non-zero exit if any error-level violation.
node examples/evaluation/dist/cli.js facts.json --sarif results.sarif
```

Against `examples/app` you'll see something like:

```
factlas evaluation — example-design-system-bundle@1.0.0
  [x] error   color-off-token          9
  [!] warning no-arbitrary-tailwind    2
  [!] warning no-inline-style          6
  [i] note    needs-review             5
  22 findings (9 error, 8 warning, 5 note) -> FAIL
```

Programmatic use:

```ts
import { evaluate, toSarif } from '@factlas/example-evaluation';

const { violations, ok } = await evaluate(facts); // facts: Fact[] from @factlas/core
const sarifLog = toSarif(await evaluate(facts));
```

## What each policy shows

- **`color-off-token`** (error) — a literal `color` fact whose normalized value
  isn't an allowed token. This is the load-bearing demo: it only works because the
  token allowed-set is normalized with the **same `@factlas/core` normalizers** the
  facts were, so `#3366FF` (token) and `#3366ff` (fact) compare equal. Reimplement
  the normalizer downstream and every check silently drifts — see
  [`src/reference.ts`](./src/reference.ts).
- **`no-arbitrary-tailwind`** (warning) — `css.class` facts with `is_arbitrary`
  (`text-[#123456]`, `w-[13px]`).
- **`no-inline-style`** (warning) — `css.declaration` facts with `source = 'inline'`.
- **`needs-review`** (note) — **certainty routing.** Values factlas couldn't
  resolve (`dynamic`/`unknown`) are never silently passed or failed by the value
  policies; `color-off-token` restricts itself to `certainty = 'literal'`, and these
  facts surface here for a human (or a gated Tier-2 check) instead.

## Policies are just data

A rule is a row in [`policies/bundle.json`](./policies/bundle.json) pointing at a
`.sql` file that **selects violation rows** — zero rows = pass. Every query returns
the same columns (`fact_id, file, line, col, message`), which is the whole contract
the evaluator needs. Editing a policy means editing SQL; no code change.

## Wiring the SARIF into CI (GitHub code scanning)

The SARIF file drops straight into GitHub's code-scanning UI:

```yaml
# .github/workflows/design-conformance.yml (illustrative — not enabled in this repo)
- run: npx @factlas/cli extract ./src --out facts.json
- run: node path/to/factlas-eval facts.json --sarif results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

The evaluator's non-zero exit on any `error`-level violation is the gate; the SARIF
upload gives inline PR annotations on top.

## Determinism

Because the fact stream is deterministic and content-addressed, so is everything
here: the same facts + the same bundle always produce byte-identical SARIF (asserted
in [`src/evaluate.test.ts`](./src/evaluate.test.ts)). Steps can be cached and diffed
independently of extraction.

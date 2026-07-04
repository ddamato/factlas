# examples

A hypothetical repository that shows how factlas runs in practice. The pieces sit
as siblings so their relationship is visible:

- **`app/`** — the code under inspection: a **standalone, runnable** React app
  (Vite + TypeScript, with its own `package.json`) that exercises **every** fact
  kind, source, and certainty level (CSS Modules, inline styles, styled/emotion,
  Tailwind; imports, JSX elements/props) with realistic anti-patterns. It
  **consumes `design-system/`** — importing that token binding — so you can see a
  real app drawing on the source of truth it's checked against. Run it on its own:
  `cd app && npm install && npm run dev` (see [`app/`](./app)).
- **`design-system/`** — the source of truth: `tokens.json` (allowed tokens, DTCG),
  `tokens.ts` (the binding the app imports), `guidelines.md` (the human rules), and
  `policy.json` (their machine-checkable form). See [`design-system/`](./design-system).
- **`evaluation/`** — a **runnable** reference for what a consumer does *with* the
  facts: a shared harness loads them into a SQLite DB and runs `design-system/policy.json`
  against `app/`, feeding two reporters — [evalite](https://evalite.dev) scores each
  policy, and SARIF for machines/CI. Demonstrates
  [docs/DOWNSTREAM.md](../docs/DOWNSTREAM.md). (Out of factlas's scope — shown with
  off-the-shelf tech.)

`app/` is a **standalone app** you can install and run from its own folder; it lives
outside the monorepo workspace. `design-system/` is plain source (tokens, guidelines,
the policy bundle). factlas reads both **statically — it never executes them**, so the
app's intentional variety is what gets evaluated. `evaluation/` is a workspace package
that CI typechecks and lints (no build — evalite and `tsx` run its TypeScript
directly). These are *examples*, not a test of factlas itself — the shipped packages
carry their own tests.

## Running the examples

**Run the app itself** (standalone — from its own folder, no monorepo setup):

```bash
cd app
npm install
npm run dev      # open the printed URL; or `npm run build` for a production build
```

Everything below is factlas *analyzing* that app, and starts from the **repository
root** (the top-level `factlas/` folder). First-time setup, run once:

```bash
npm install     # install the whole monorepo
npm run build   # compile the packages the CLI and the evaluation example need
```

**Extract facts from the sample app** with the CLI (`npx` resolves the workspace
`@factlas/cli` after the build above, or the published package elsewhere):

```bash
npx @factlas/cli extract examples/app
```

That prints a one-line summary followed by the facts as NDJSON (one per line). Add
`--out facts.ndjson` to write them to a file instead.

**Run the conformance evaluation** — load facts into SQLite, score `app/` against
`design-system/policy.json`, and emit SARIF. That lives in the `evaluation/` package
and has its own step-by-step guide (including the exact folder to run from and a
troubleshooting list):

➡️ **[examples/evaluation/README.md → Run it](./evaluation/README.md#run-it-step-by-step)**

> The runnable package is **`examples/evaluation`**, not `examples/`. `cd examples`
> alone has no scripts — that's the usual "Missing script" gotcha.

`app/` is excluded from Biome so its intentional variety (mixed-case hex, camelCase,
arbitrary Tailwind values) survives.

# examples

A hypothetical repository that shows how factlas runs in practice. The pieces sit
as siblings so their relationship is visible:

- **`app/`** — the code under inspection: a consumer app that exercises **every**
  fact kind, source, and certainty level (CSS Modules, inline styles,
  styled/emotion, Tailwind; imports, JSX elements/props). Each construct is
  annotated with the fact(s) it emits, so the app doubles as living documentation.
  It **consumes `design-system/`** — importing that token binding — so you can see
  a real app drawing on the source of truth it's checked against.
- **`design-system/`** — the source of truth: `tokens.json` (allowed tokens, DTCG),
  `tokens.ts` (the binding the app imports), `guidelines.md` (the human rules), and
  `policy.json` (their machine-checkable form). See [`design-system/`](./design-system).
- **`evaluation/`** — a **runnable** reference for what a consumer does *with* the
  facts: load them into a SQLite DB, score `app/` against `design-system/policy.json`
  with [evalite](https://evalite.dev), and emit SARIF + a CI gate. Demonstrates
  [docs/DOWNSTREAM.md](../docs/DOWNSTREAM.md). (Out of factlas's scope — shown with
  off-the-shelf tech.)

`app/` and `design-system/` are **fixtures**, parsed statically and never built or
executed (dependencies aren't installed; imports need not resolve). `evaluation/` is
a real workspace package that CI builds, typechecks, and lints. These are *examples*,
not a test of factlas itself — the shipped packages carry their own tests.

Run the CLI against the app (from the repo root; `npx` resolves the workspace CLI
after `npm run build`, or the published `@factlas/cli` elsewhere):

```bash
npx @factlas/cli extract examples/app
```

`app/` is excluded from Biome so its intentional variety (mixed-case hex, camelCase,
arbitrary values, unresolved imports) survives.

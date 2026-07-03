# examples

Test targets for Factlas — parsed **statically**, never built or executed (no
dependencies are installed; imports need not resolve).

- **`app/`** — a full design-system-consumer app exercising every fact kind,
  source, and certainty level end to end.
- **`plugins/`** — one focused, annotated showcase per plugin. Each comment
  states the fact(s) that plugin emits for the construct on that line, so the
  files double as living documentation.
- **`evaluation/`** — a **runnable** reference for what a consumer does *with* the
  facts: load them into a store, compare against normalized token allowed-sets,
  run SQL policies, and emit SARIF + a CI gate. Demonstrates
  [docs/DOWNSTREAM.md](../docs/DOWNSTREAM.md) on the `app/` above. (Out of factlas's
  scope — shown with off-the-shelf tech.)

Run the CLI against any of them (from the repo root; `npx` resolves the
workspace CLI after `npm run build`, or the published `@factlas/cli` elsewhere):

```bash
npx @factlas/cli extract examples/app
npx @factlas/cli extract examples/plugins/plugin-tailwind
```

These directories are excluded from Biome so the intentional variety (mixed-case
hex, camelCase, arbitrary values, unresolved imports) survives.

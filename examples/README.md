# examples

Test targets for Factlas — parsed **statically**, never built or executed (no
dependencies are installed; imports need not resolve).

- **`app/`** — a full design-system-consumer app exercising every fact kind,
  source, and certainty level end to end.
- **`plugins/`** — one focused, annotated showcase per plugin. Each comment
  states the fact(s) that plugin emits for the construct on that line, so the
  files double as living documentation.

Run the CLI against any of them:

```bash
factlas extract examples/app
factlas extract examples/plugins/plugin-tailwind
```

These directories are excluded from Biome so the intentional variety (mixed-case
hex, camelCase, arbitrary values, unresolved imports) survives.

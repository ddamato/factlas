# @factlas/cli

The [Factlas](../../README.md) command line: point it at a TypeScript/TSX + CSS
repository — locally or in CI — and get a deterministic, content-addressed **fact
stream** out. Static analysis only; it never executes your code.

> Extraction only. Factlas measures *what your code contains*; deciding whether
> that conforms to a design system (store, policies, scoring, gating) is a
> downstream concern — see [docs/DOWNSTREAM.md](../../docs/DOWNSTREAM.md).

## Install

```
npm install -g @factlas/cli
# or, ad hoc:
npx @factlas/cli extract ./src
```

## Usage

```
factlas extract [path] [options]
```

```
-o, --out <file>       Write output to <file> instead of stdout
    --json             Emit the { snapshot_header, facts } object (canonical JSON,
                       includes the snapshot header) instead of the default NDJSON
    --pretty           Pretty-print the review JSON object (implies --json)
    --include <glob>   Glob to include (repeatable; default: **/*.{ts,tsx,css})
    --exclude <glob>   Glob to exclude (repeatable)
    --config <file>    Config file folded into the snapshot header (repeatable;
                       e.g. tailwind.config.ts) so a change invalidates caches
    --stats            Print a coverage summary (kinds/certainty/sources +
                       unknown-rate) to stderr
    --no-cache         Disable the incremental cache (.factlas/cache.json);
                       re-extract every file
-h, --help             Show help
-v, --version          Show version
```

### Incremental cache

By default the CLI keeps a content-hash cache at `.factlas/cache.json` under the
scanned directory: a file whose bytes are unchanged (and whose determinism
signature — schema/normalizer versions, plugin & tool versions, config hashes —
still matches) reuses its facts instead of being re-parsed. Output is byte-for-byte
identical either way; only recomputation is skipped. A version or config change
invalidates the whole cache. Add `.factlas/` to your `.gitignore`, or pass
`--no-cache` to disable it.

### Examples

```bash
# Print the fact stream (NDJSON) for the current repo
factlas extract .

# Write NDJSON to a file, hashing the Tailwind config into the snapshot header
factlas extract ./src --out facts.ndjson --config tailwind.config.ts

# In CI: pipe facts straight into a database / evaluation step
factlas extract . | your-loader

# The { snapshot_header, facts } object, for reading by eye
factlas extract . --json --pretty
```

## Output

**NDJSON by default** — one JSON fact per line — because the point of a fact stream
is to load it into a database and query it. Each line is a complete, content-addressed
record, so it drops straight into any generic loader (SQLite, DuckDB, `jq`, …) with no
unwrapping:

```
{"fact_id":"1d52…","kind":"css.declaration","file":"Button.css","certainty":"literal","value":{"raw":"#FFF","norm":"#ffffff","type":"color"},"subject":{"property":"color","…":"…"}}
{"fact_id":"9af3…","kind":"css.class","…":"…"}
```

Pass `--json` for the `{ snapshot_header, facts }` object instead (adds the snapshot
header — `schema_v`, `cache_key`, tool/plugin versions), or `--json --pretty` to
pretty-print it for review. A per-run summary (file/fact counts, dynamic/unknown,
diagnostics) always goes to **stderr**, so **stdout** stays a clean stream.

## Default plugins

`extract` runs the five defaults: `@factlas/plugin-jsx`, `@factlas/plugin-css`,
`@factlas/plugin-inline-style`, `@factlas/plugin-styled`,
`@factlas/plugin-tailwind`. To compose your own set, use the programmatic API:

```ts
import { extractRepo } from '@factlas/cli'; // or '@factlas/core'
const { facts } = await extractRepo({ root: '.', plugins: [/* ... */] });
```

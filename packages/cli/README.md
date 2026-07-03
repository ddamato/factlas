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
    --include <glob>   Glob to include (repeatable; default: **/*.{ts,tsx,css})
    --exclude <glob>   Glob to exclude (repeatable)
    --config <file>    Config file folded into the snapshot header (repeatable;
                       e.g. tailwind.config.ts) so a change invalidates caches
    --pretty           Pretty-print JSON (default: compact canonical JSON)
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
# Print the fact stream for the current repo
factlas extract .

# Write to a file, hashing the Tailwind config into the snapshot header
factlas extract ./src --out facts.json --config tailwind.config.ts

# In CI: pipe facts onward to your evaluation step
factlas extract . | your-evaluator
```

## Output

Canonical JSON with a stable shape:

```json
{
  "snapshot_header": { "schema_v": "...", "cache_key": "...", "...": "..." },
  "facts": [ { "fact_id": "...", "kind": "css.declaration", "...": "..." } ]
}
```

A per-run summary (file count, fact count, dynamic/unknown count, diagnostics) is
written to **stderr**, so **stdout** stays pure JSON for piping.

## Default plugins

`extract` runs the four defaults: `@factlas/plugin-css`,
`@factlas/plugin-inline-style`, `@factlas/plugin-styled`,
`@factlas/plugin-tailwind`. To compose your own set, use the programmatic API:

```ts
import { extractRepo } from '@factlas/cli'; // or '@factlas/core'
const { facts } = await extractRepo({ root: '.', plugins: [/* ... */] });
```

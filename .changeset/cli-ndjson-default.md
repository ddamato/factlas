---
"@factlas/cli": minor
---

`factlas extract` now prints **NDJSON by default** — one fact per line — so the output loads straight into a database (querying facts for evaluation is the whole point of the stream). Each line is a complete, content-addressed fact record; pipe it into SQLite/DuckDB/`jq` with no unwrapping.

The previous `{ snapshot_header, facts }` object is now opt-in via `--json` (add `--pretty` to pretty-print it for review). The snapshot header appears only in that mode.

**Breaking:** anything that parsed `factlas extract` stdout as a single JSON object must now pass `--json`, or read the output line-by-line as NDJSON.

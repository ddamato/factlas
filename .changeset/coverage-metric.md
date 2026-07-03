---
"@factlas/cli": patch
---

Add a coverage summary: `factlas extract --stats` prints facts by
kind/certainty/source plus the `unknown`/`dynamic` rate and per-reason
diagnostics to stderr (stdout stays pure JSON). Exposes `coverageReport` and
`formatCoverage` from the package for programmatic use.

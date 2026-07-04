# Contributing to factlas

Thanks for your interest in factlas. This is a **deterministic fact-extraction
engine**: the highest-value contributions keep it deterministic, static, and
honest. Please read the README's [Design](./README.md#design) section for the
rationale before proposing anything structural.

## Non-negotiable invariants

Every change must uphold the determinism guarantees (see the README's
[Design](./README.md#design) section). In short:

1. **Deterministic.** Identical inputs produce byte-identical output. Never depend
   on filesystem order, wall-clock time, locale, `Map`/`Set` iteration of unsorted
   input, or hash randomization. Sort everything; the golden-fixture snapshot test
   in `@factlas/e2e` is the gate.
2. **Static only.** Never execute repository code, load its config as a module, or
   resolve across `node_modules`. The [bounded resolver](./packages/core/src/plugin/resolve.ts)
   is deliberately tiny — one binding hop, literals only, in-file only.
3. **Never drop.** An unresolved value becomes an honest `dynamic`/`unknown` fact
   **with a diagnostic reason** — never a silent omission and never a fabricated
   value.
4. **Plugins never normalize.** Plugins emit *raw observations*; core alone
   normalizes, decides certainty, canonicalizes subjects, and assigns `fact_id`
   (see [`assemble.ts`](./packages/core/src/assemble.ts)). If you find yourself
   lowercasing a color inside a plugin, stop — that belongs in a core normalizer.

A PR that weakens any of these will be asked to change, no matter how useful the
feature.

## Repository layout

npm workspaces + Turborepo, ESM-only, TypeScript.

| Path | What |
|---|---|
| [`packages/core`](./packages/core) | The fact layer: schema, determinism spine, parsing, plugin host, normalizers. Everything else depends on it. |
| `packages/plugin-*` | Extractors. Each emits raw observations for one source (css, inline-style, styled, tailwind, jsx). |
| [`packages/cli`](./packages/cli) | `factlas extract` — the thin repo-runner. |
| `packages/e2e` | The golden-fixture determinism gate. |
| [`docs/`](./docs) | [DOWNSTREAM.md](./docs/DOWNSTREAM.md) (out-of-scope eval system) and [SCHEMA_MIGRATION.md](./docs/SCHEMA_MIGRATION.md). |

## Development

Requires Node ≥ 20.

```bash
npm install
npm run build       # tsup, all packages
npm test            # vitest, incl. the golden determinism gate
npm run typecheck   # tsc --noEmit, all packages
npm run lint        # biome check
```

Turborepo caches build/test/typecheck; run a single package's tests with
`npm test -w @factlas/plugin-css` (or `npx vitest` inside the package).

### Regenerating snapshots

```bash
npx vitest run -u        # update snapshots in the current package
```

Only commit a regenerated snapshot when the diff is **intentional**. An unexplained
snapshot change is a determinism regression — investigate before updating.

### A note on Windows / shells

The repo builds and tests on Windows, macOS, and Linux. On Windows, native tool
stderr can surface in PowerShell as red `NativeCommandError` text even on success —
check the exit code, not the color.

## Adding or changing a plugin

1. Emit **raw observations** via `ctx.emit(...)`; never compute a `fact_id` or a
   `norm` yourself. Use `ctx.resolve(...)` for values and `ctx.diagnostic(...)` for
   anything you can't resolve.
2. Reference the owning element through core's shared
   [`jsxElementId`](./packages/core/src/jsx.ts) so your `element_id` matches the one
   `plugin-jsx` assigns — never re-derive element identity locally.
3. Read the producer version from the package's own `package.json` (the established
   pattern) so it can never drift from the published version.
4. Add unit tests in the package, and — if the fixture app exercises your case — an
   assertion in `@factlas/e2e`.

## Changing the fact shape or a normalizer

This is a **migration**. Follow [docs/SCHEMA_MIGRATION.md](./docs/SCHEMA_MIGRATION.md)
exactly: bump the right constant, update the JSON Schema, regenerate snapshots, and
add a changeset. Do not sneak a normalization change in without bumping
`NORMALIZER_VERSION` — silent output drift is the one thing this project cannot
tolerate.

## Commits & changesets

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
  `fix:`, `chore:`, `docs:`).
- Any change to a **published** package needs a changeset:
  ```bash
  npm run changeset
  ```
  Pick the packages and semver bump; write the changeset body for a *consumer*
  reading a changelog. Docs-only or CI-only changes don't need one.
- Releases are automated: merging to `main` opens (or updates) a **Version
  Packages** PR via Changesets; merging *that* publishes to npm with provenance.
  Don't bump versions or edit `CHANGELOG.md` by hand.

## Opening a PR

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Ensure `npm run build && npm test && npm run typecheck && npm run lint` all pass.
3. Include a changeset if a published package changed.
4. Keep PRs focused — one concern each. Migrations especially should stand alone so
   the snapshot diff is reviewable.

By contributing, you agree your contributions are licensed under the repository's
[MIT license](./LICENSE).

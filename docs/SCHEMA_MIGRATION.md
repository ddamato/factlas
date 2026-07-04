# Schema & normalizer migrations

Factlas is a **determinism engine**: identical inputs must produce byte-identical
facts, forever, until we deliberately decide otherwise. Two version constants in
[`packages/core/src/version.ts`](../packages/core/src/version.ts) encode "what a
fact means" and "how a value is normalized." Changing either is a **migration** —
a breaking change to the fact contract that invalidates every downstream cache and
requires a full re-extract. This document defines when to bump which, and the
exact procedure.

Both constants are folded into the snapshot header and the run `cache_key`
(ADR §2.4), so a bump automatically invalidates caches. `schema_v` is also stamped
onto every individual fact.

## The two constants

### `FACT_SCHEMA_VERSION` — the shape of a fact

Bump when you change **what a fact *is*** — its envelope, its `subject` shape, the
`kind` catalog, or the meaning of an existing field. Examples:

- Adding, removing, or renaming a field on any `*Subject` (e.g. adding
  `element_id` to `CssDeclarationSubject`).
- Adding or removing a `FactKind` or `FactSource`.
- Adding a `ValueType` or changing what an existing one denotes.
- Changing which fields feed the `fact_id` (see [`factify.ts`](../packages/core/src/factify.ts)).

A schema bump changes `schema_v` on **every** emitted fact, so every `fact_id`
that includes a changed field also changes. Treat it as breaking.

### `NORMALIZER_VERSION` — how a value is compared

Bump when you change **how a `raw` value becomes a `norm` value**, or how the
bounded resolver decides certainty — anything that can change a fact's `value.norm`
or `certainty` without changing the fact's *shape*. Examples:

- Editing any normalizer under [`packages/core/src/normalize/`](../packages/core/src/normalize/)
  (color, length, keyword, property, value, format).
- Changing the [bounded resolver](../packages/core/src/plugin/resolve.ts) so it
  resolves more (or fewer) expressions — e.g. adding member-access resolution, or
  changing what counts as a `static-union`.
- Changing a plugin's value **classification** in a way that alters the normalized
  result (e.g. treating an inline numeric as a `px` length).

> **Why the resolver counts as normalization.** The resolver has no version of its
> own in the header. Changing it silently changes `value.norm`/`certainty` across
> runs, which is exactly what `NORMALIZER_VERSION` exists to signal. Always bump it
> when resolver behavior changes.

### When in doubt

If a change alters committed golden snapshots but you can't tell which constant to
bump: a change to a fact's **structure** → `FACT_SCHEMA_VERSION`; a change only to
its **values/certainty** → `NORMALIZER_VERSION`. If both change, bump both.

A pure additive plugin change that emits *new* facts without touching the shape or
normalization of existing ones needs **neither** bump — only a package version bump
via a changeset.

## Versioning scheme

Both constants are independent semver strings. For v0.x, bump the **minor** for any
migration (`0.1.0` → `0.2.0`); reserve **patch** for a fix that corrects a
normalizer/schema bug whose old output was simply wrong. Post-1.0, any
observable change to output is a **major** bump of the affected constant.

The two constants version independently: a normalizer change bumps
`NORMALIZER_VERSION` alone and leaves `FACT_SCHEMA_VERSION` untouched, and vice
versa.

## Migration procedure

Do all of this in **one PR**, so the version bump and the regenerated fixtures land
together and CI's determinism gate stays green:

1. **Make the change** in the TypeScript types ([`fact.ts`](../packages/core/src/fact.ts)),
   the normalizer, or the resolver. The **types are the single source of truth**.
2. **Bump the constant** in [`version.ts`](../packages/core/src/version.ts) — minor
   for a migration.
3. **Regenerate the schema artifacts** if the fact shape changed:
   ```bash
   npm run generate -w @factlas/core
   ```
   This regenerates [`schema/fact.schema.json`](../packages/core/schema/fact.schema.json)
   **and** [`schema/columns.json`](../packages/core/schema/columns.json) (the DB column
   manifest) from the types — **don't hand-edit them**. A drift test
   ([`schema-generated.test.mjs`](../packages/core/src/schema-generated.test.mjs)) fails
   if the committed files don't match the types.
4. **Regenerate golden snapshots.** The determinism fixture in `@factlas/e2e` will
   fail until updated:
   ```bash
   npm test -- -u        # or: npx vitest run -u
   ```
   Review the snapshot diff deliberately — it *is* the migration. Confirm every
   changed fact changed for the reason you intended, and nothing else moved.
5. **Add a changeset** describing the migration. Bump `@factlas/core` (minor) plus
   any plugin whose emitted facts changed; dependents cascade as `patch`.
6. **Update docs** if the change is user-visible (README example, package READMEs).

> **Committing regenerated snapshots is correct here.** These snapshots are
> regenerated inside the *feature* PR, not by the automated Version PR. (The header
> fields `producer_v` / `plugin_versions` / `cache_key` are stripped from the
> committed fixture precisely so the automated version bump never has to regenerate
> it — see [`golden.test.ts`](../packages/e2e/src/golden.test.ts). `schema_v` is
> *not* stripped, because a schema migration is a deliberate, reviewed change.)

## What a migration means downstream

A consumer that has stored facts keyed by `fact_id`, or cached a `cache_key`, must
**re-extract** after a migration — old and new facts are not comparable. The bumped
`schema_v` / `normalizer_v` in the snapshot header is the signal to do so. Factlas
never attempts to migrate stored facts in place; re-extraction is always cheap and
always correct.

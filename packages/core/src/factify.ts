/**
 * Content-addressed `fact_id` assignment.
 *
 * The `fact_id` is the sha256 of the canonical form of
 * `{kind, file, loc, subject, norm}` — where `norm` is the *normalized* value
 * (`value.norm`), never `raw`. This means `#FFF` and `#ffffff` collapse to one
 * fact, and identical facts across runs/platforms share an id (idempotent
 * upserts downstream).
 */

import { canonicalStringify, sha256Hex } from './canonical.js';
import type { Fact, FactKind, Loc } from './fact.js';
import { FACT_SCHEMA_VERSION } from './version.js';

/** The exact tuple hashed into a `fact_id`. */
export interface FactIdInput {
  kind: FactKind;
  file: string;
  loc: Loc;
  subject: unknown;
  /** The normalized value (`value.norm`); `null` when the fact carries no value. */
  norm: string | null;
}

/** Compute the content-addressed `fact_id` for a fact's identity tuple. */
export function computeFactId(input: FactIdInput): string {
  const canonical = canonicalStringify({
    kind: input.kind,
    file: input.file,
    loc: input.loc,
    subject: input.subject,
    norm: input.norm,
  });
  return sha256Hex(canonical);
}

/** Distributive `Omit` so the union's discriminant is preserved per member. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A fact minus the fields this module derives (`fact_id`, `schema_v`). */
export type FactDraft = DistributiveOmit<Fact, 'fact_id' | 'schema_v'>;

/**
 * Finalize a drafted fact: derive its `fact_id` and stamp `schema_v`.
 * The single place a `Fact` becomes complete; plugins never assign ids.
 */
export function factify(draft: FactDraft): Fact {
  const value = (draft as { value?: { norm: string | null } }).value;
  const norm = value ? value.norm : null;
  const fact_id = computeFactId({
    kind: draft.kind,
    file: draft.file,
    loc: draft.loc,
    subject: draft.subject,
    norm,
  });
  return { ...draft, fact_id, schema_v: FACT_SCHEMA_VERSION } as Fact;
}

/**
 * Assembly: raw observation → normalized, content-addressed Fact (Phase 3 step 9).
 *
 * This is where a plugin's raw observation becomes a real {@link Fact}. Core —
 * never the plugin — decides the final certainty, normalizes the value with the
 * versioned normalizers, canonicalizes the subject (e.g. property names), and
 * assigns the `fact_id`. It enforces the non-negotiable invariants:
 *
 * - A `dynamic`/`unknown` fact has `value.norm === null` and is never compared to
 *   an allowed-set (ADR §2.4 rule 6, §2.5).
 * - A value that claims to be literal but cannot be normalized degrades to an
 *   honest `unknown` with a diagnostic reason — never a silent pass or drop.
 * - Every `dynamic`/`unknown` fact carries a diagnostic reason.
 */

import { classifyCertainty } from './classify.js';
import type { ExtractFileResult } from './extract/extractFile.js';
import type { Certainty, Fact, FactValue, Loc } from './fact.js';
import { type FactDraft, factify } from './factify.js';
import { normalizeProperty } from './normalize/property.js';
import { normalizeValue } from './normalize/value.js';
import type { EmittedObservation, Observation } from './plugin/types.js';

/** Input to {@link assembleFact}: one observation plus its origin. */
export interface AssembleInput {
  /** Repo-relative POSIX path. */
  file: string;
  /** Producer id, `name@version`. */
  producer: string;
  observation: Observation;
}

/** Turn a single raw observation into a finalized, normalized Fact. */
export function assembleFact(input: AssembleInput): Fact {
  const { file, producer, observation } = input;
  const rawValue = 'value' in observation ? observation.value : undefined;

  let certainty = classifyCertainty(rawValue);
  let value: FactValue | undefined;
  let diagnostic = observation.diagnostic;

  if (rawValue) {
    if (certainty === 'dynamic' || certainty === 'unknown') {
      // Invariant: unresolved values never carry a comparable norm.
      value = { raw: rawValue.raw, norm: null, type: rawValue.type };
      diagnostic ??= `${certainty}-value`;
    } else {
      const norm = normalizeValue(rawValue.type, rawValue.raw);
      if (norm === null && !isUncomparableType(rawValue.type)) {
        // Claimed literal but unnormalizable → honest unknown, never a drop.
        certainty = 'unknown';
        value = { raw: rawValue.raw, norm: null, type: rawValue.type };
        diagnostic ??= `unnormalizable-${rawValue.type}`;
      } else {
        value = { raw: rawValue.raw, norm, type: rawValue.type };
      }
    }
  }

  const draft = buildDraft({
    observation,
    file,
    producer,
    certainty,
    value,
    diagnostic,
  });
  return factify(draft);
}

/** Assemble every observation from an extracted file into sorted Facts. */
export function assembleFacts(result: ExtractFileResult): Fact[] {
  const facts = result.observations.map((emitted: EmittedObservation) =>
    assembleFact({
      file: result.file,
      producer: emitted.producer,
      observation: emitted.observation,
    }),
  );
  return sortFacts(facts);
}

/**
 * Deterministically sort facts for stable output (ADR §2.4 rule 1). Order:
 * file, then position, then kind, then `fact_id` as a total-order tiebreak.
 */
export function sortFacts(facts: readonly Fact[]): Fact[] {
  return [...facts].sort(compareFacts);
}

function compareFacts(a: Fact, b: Fact): number {
  return (
    cmp(a.file, b.file) ||
    a.loc.line - b.loc.line ||
    a.loc.col - b.loc.col ||
    cmp(a.kind, b.kind) ||
    cmp(a.fact_id, b.fact_id)
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Types that legitimately have no single comparable norm. */
function isUncomparableType(type: FactValue['type']): boolean {
  return type === 'union' || type === 'dynamic';
}

/** Normalize the subject (currently: canonicalize CSS property names). */
function normalizeSubject(observation: Observation): Observation['subject'] {
  if (observation.kind === 'css.declaration') {
    return { ...observation.subject, property: normalizeProperty(observation.subject.property) };
  }
  return observation.subject;
}

interface DraftParts {
  observation: Observation;
  file: string;
  producer: string;
  certainty: Certainty;
  value: FactValue | undefined;
  diagnostic: string | undefined;
}

/** Build the pre-`fact_id` draft; omits `value`/`diagnostic` when absent. */
function buildDraft(parts: DraftParts): FactDraft {
  const { observation, file, producer, certainty, value, diagnostic } = parts;
  const loc: Loc = observation.loc;
  const base = {
    kind: observation.kind,
    file,
    loc,
    source: observation.source,
    producer_v: producer,
    certainty,
    subject: normalizeSubject(observation),
    ...(value !== undefined ? { value } : {}),
    ...(diagnostic !== undefined ? { diagnostic } : {}),
  };
  return base as unknown as FactDraft;
}

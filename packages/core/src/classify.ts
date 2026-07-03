/**
 * Certainty classification (ADR §2.5 / §3 Phase 3 step 7).
 *
 * Reduces a plugin's raw value observation to a final {@link Certainty}. Plugins
 * hint; core decides. The decision tree is deliberately small and total so it is
 * easy to audit:
 *
 * 1. No value (e.g. `jsx.element`) → `literal` (identity is always concrete).
 * 2. Detected dynamic placeholder, or `dynamic` type → `dynamic`.
 * 3. `union` type → `static-union` (all members must be judged legal).
 * 4. Otherwise honor the plugin's `certaintyHint`, defaulting to `literal`.
 */

import type { Certainty } from './fact.js';
import type { RawObservationValue } from './plugin/types.js';

/** Classify the final certainty for an observed value (or absence of one). */
export function classifyCertainty(value?: RawObservationValue): Certainty {
  if (!value) return 'literal';
  if (value.dynamic || value.type === 'dynamic') return 'dynamic';
  if (value.type === 'union') return 'static-union';
  return value.certaintyHint ?? 'literal';
}

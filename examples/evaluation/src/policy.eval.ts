/**
 * The evalite reporter for `design-system/policy.json` (DOWNSTREAM.md §4). One
 * `*.eval.ts` corresponds to one policy bundle; its cases are the individual
 * policies inside. Each enforceable policy is scored against the fact database:
 * it passes (1) when its SQL selects zero violation rows, and fails (0) otherwise.
 *
 * This is a demonstration, not a test of factlas: the facts, the DB, and the SQL
 * are all fixed, so evalite here is a scoring surface. It shows the app
 * (examples/app) evaluated against the design system (examples/design-system)
 * the app draws its tokens from. The shared setup — extract, store, load
 * policies, run a policy — lives in `harness.ts`; this file only scores.
 *
 * Run it:  npm run eval -w @factlas/example-evaluation   (evalite run)
 */

import { createScorer, evalite } from 'evalite';
import { prepare, runPolicy } from './harness.js';

const { db, policySet } = await prepare();
const policiesById = new Map(policySet.policies.map((policy) => [policy.id, policy]));

/** Enforceable policies are scored pass/fail; `note` policies are advisory. */
const enforceable = policySet.policies.filter((policy) => policy.level !== 'note');

const zeroViolations = createScorer<string, number, number>({
  name: 'No violations',
  description: 'Passes (1) when the policy selects zero violation rows, else 0.',
  scorer: ({ output }) => (output === 0 ? 1 : 0),
});

evalite<string, number, number>('design-system/policy.json vs examples/app', {
  // One case per enforceable policy; the expected violation count is zero.
  data: async () => enforceable.map((policy) => ({ input: policy.id, expected: 0 })),
  // The "output" is the number of violation rows the policy's SQL selects.
  task: async (policyId) => {
    const policy = policiesById.get(policyId);
    if (!policy) return 0;
    return runPolicy(db, policy).length;
  },
  scorers: [zeroViolations],
});

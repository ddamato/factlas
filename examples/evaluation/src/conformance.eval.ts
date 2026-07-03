/**
 * evalite scoring (DOWNSTREAM.md §4). Score each enforceable policy against the
 * fact database: a policy passes (1) when it selects zero violation rows, fails
 * (0) otherwise. Deterministic — the facts, the DB, and the SQL are all fixed —
 * so evalite here is a reporting/scoring surface, not a stochastic eval.
 *
 * Run it:  npm run build && npm run eval    (evalite run)
 *
 * Imports the package's own public API from its built output (self-reference via
 * the `exports` map), so `npm run eval` builds first.
 */

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRepo } from '@factlas/core';
import { buildDatabase, loadPolicies, runPolicy } from '@factlas/example-evaluation';
import cssPlugin from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import jsx from '@factlas/plugin-jsx';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';
import { createScorer, evalite } from 'evalite';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../app');
const DB_FILE = path.resolve(here, '../.eval/facts.db');

// Extract the sample app, then save the facts into an on-disk SQLite DB — the
// same artifact `factlas-eval --db` produces — and score policies against it.
const { facts } = await extractRepo({
  root: APP,
  plugins: [jsx, cssPlugin, inlineStyle, styled, tailwind],
});
mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = await buildDatabase(facts, { file: DB_FILE });
const policySet = await loadPolicies();
const policiesById = new Map(policySet.policies.map((policy) => [policy.id, policy]));

/** Enforceable policies are scored pass/fail; `note` policies are advisory (SARIF only). */
const enforceable = policySet.policies.filter((policy) => policy.level !== 'note');

const zeroViolations = createScorer<string, number, number>({
  name: 'No violations',
  description: 'Passes (1) when the policy selects zero violation rows, else 0.',
  scorer: ({ output }) => (output === 0 ? 1 : 0),
});

evalite<string, number, number>('Acme design-system conformance', {
  // One case per enforceable policy; expected violation count is zero.
  data: async () => enforceable.map((policy) => ({ input: policy.id, expected: 0 })),
  // The "output" is the number of violation rows the policy's SQL returns.
  task: async (policyId) => {
    const policy = policiesById.get(policyId);
    return policy ? runPolicy(db, policy).length : 0;
  },
  scorers: [zeroViolations],
});

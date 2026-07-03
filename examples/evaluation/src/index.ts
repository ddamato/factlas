/**
 * @factlas/example-evaluation — a runnable reference for the downstream
 * evaluation pipeline described in docs/DOWNSTREAM.md. **Demonstration only**;
 * not part of the shipped factlas project and not published.
 *
 * Flow: design-system guidelines -> compiled policy set; facts -> SQLite DB ->
 * normalized allowed-sets -> policies (SQL) -> violations -> evalite scores +
 * SARIF + a pass/fail gate.
 */

export { openDatabase, loadFacts } from './store.js';
export type { FactDb } from './store.js';
export { loadAllowedSets } from './reference.js';
export { buildDatabase } from './database.js';
export type { BuildDatabaseOptions } from './database.js';
export { loadPolicies } from './policy.js';
export type { Level, Policy, PolicySet } from './policy.js';
export { evaluate, runPolicies, runPolicy } from './evaluate.js';
export type { EvalResult, EvaluateOptions, Violation } from './evaluate.js';
export { toSarif } from './sarif.js';
export { formatReport } from './report.js';

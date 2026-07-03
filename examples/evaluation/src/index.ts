/**
 * @factlas/example-evaluation — a runnable reference for the downstream
 * evaluation pipeline described in docs/DOWNSTREAM.md. **Demonstration only**;
 * not part of the shipped factlas project and not published.
 *
 * Pipeline: facts -> SQLite store -> normalized allowed-sets -> policy bundle
 * (SQL) -> violations -> SARIF + a pass/fail gate.
 */

export { createFactStore } from './store.js';
export { loadAllowedSets } from './reference.js';
export { loadBundle } from './bundle.js';
export type { Bundle, LoadedBundle, LoadedRule, Level, Rule } from './bundle.js';
export { evaluate } from './evaluate.js';
export type { EvalResult, EvaluateOptions, Violation } from './evaluate.js';
export { toSarif } from './sarif.js';
export { formatReport } from './report.js';

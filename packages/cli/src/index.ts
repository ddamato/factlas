/**
 * @factlas/cli — programmatic surface.
 *
 * The CLI is thin: it wraps core's `extractRepo` with the default plugins. These
 * exports let you invoke the same behavior from code or compose your own tool.
 */

export { extractRepo } from '@factlas/core';
export type { ExtractRepoOptions, ExtractRepoResult } from '@factlas/core';
export { type CoverageReport, coverageReport, formatCoverage } from './coverage.js';
export { defaultPlugins } from './plugins.js';
export { type CliIO, run, VERSION } from './run.js';

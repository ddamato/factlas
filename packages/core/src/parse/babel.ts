/**
 * Base TS/TSX parser.
 *
 * Core parses **once** with a pinned `@babel/parser` configuration and hands the
 * resulting AST to plugins. Plugins traverse it with the `traverse` re-exported
 * here, so they never take a direct dependency on Babel. Parser options are part
 * of the determinism surface — changing them is a tool-version change.
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';

/**
 * `@babel/traverse` ships as CommonJS; under ESM interop the callable lands on
 * `.default`. Normalize once so the rest of the codebase (and plugins) import a
 * plain function.
 */
export const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ??
  _traverse) as typeof _traverse;

/** Pinned parser plugin set for TS + JSX. Part of the determinism surface. */
export const BABEL_PLUGINS = ['typescript', 'jsx', 'decorators-legacy'] as const;

/** A parsed TS/TSX module. */
export interface ParsedModule {
  /** Repo-relative POSIX path. */
  file: string;
  /** The original source, retained for raw-text slicing. */
  code: string;
  ast: File;
}

/**
 * Parse a TS/TSX module to an AST. Uses `errorRecovery` so a single malformed
 * region degrades gracefully rather than aborting the whole file (unresolved
 * regions become `unknown` facts downstream, never silent drops).
 */
export function parseModule(code: string, file: string): ParsedModule {
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: file,
    errorRecovery: true,
    plugins: [...BABEL_PLUGINS],
  });
  return { file, code, ast };
}

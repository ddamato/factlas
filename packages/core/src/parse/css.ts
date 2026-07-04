/**
 * Base CSS parser.
 *
 * Core parses stylesheets **once** with PostCSS and hands the root to plugins.
 * The same entry point is reused for CSS carriers lifted out of TSX (styled
 * templates, etc.) via `PluginContext.parseCss`, so all CSS — however it was
 * authored — converges on one parser and one node shape.
 */

import postcss, { type Root } from 'postcss';

/** A parsed stylesheet. */
export interface ParsedStylesheet {
  /** Repo-relative POSIX path (or the owning module's path for css-in-js). */
  file: string;
  css: string;
  root: Root;
}

/**
 * Parse CSS text to a PostCSS root. Throws `CssSyntaxError` on malformed input;
 * callers (the extractor) catch it and emit a diagnostic rather than crashing.
 */
export function parseStylesheet(css: string, file: string): ParsedStylesheet {
  const root = postcss.parse(css, { from: file });
  return { file, css, root };
}

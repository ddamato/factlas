/**
 * @factlas/plugin-css — extract `css.declaration` facts from stylesheets.
 *
 * Walks a parsed PostCSS root and emits one observation per declaration,
 * attaching the enclosing selector and `@media` query. Values are classified by
 * type only; core normalizes them. Plain CSS is fully static, so every
 * observation is a `literal`.
 *
 * This is a bundled default plugin (ADR §2.2 / §3 Phase 4 step 10).
 */

import {
  type DesignFactsPlugin,
  type FactSource,
  type PluginContext,
  postcssLoc,
} from '@factlas/core';
import type { AtRule, Container, Declaration, Document, Root, Rule } from 'postcss';
import { classifyCssValueType } from './classify-value.js';

export { classifyCssValueType } from './classify-value.js';

const NAME = '@factlas/plugin-css';
import { readFileSync } from 'node:fs';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

export interface CssPluginOptions {
  /**
   * The source tag to stamp on emitted facts. Defaults to `plain-css`; a caller
   * analyzing a `*.module.css` file may pass `css-module`.
   */
  source?: Extract<FactSource, 'plain-css' | 'css-module'>;
}

/** Create the CSS declaration extractor plugin. */
export function cssPlugin(options: CssPluginOptions = {}): DesignFactsPlugin {
  const source: FactSource = options.source ?? 'plain-css';
  return {
    name: NAME,
    version: VERSION,
    analyzeCss(root: Root, ctx: PluginContext) {
      root.walkDecls((decl) => emitDeclaration(decl, source, ctx));
    },
  };
}

/** Default instance (plain CSS). */
export default cssPlugin();

function emitDeclaration(decl: Declaration, source: FactSource, ctx: PluginContext): void {
  const property = decl.prop;
  const raw = decl.value;
  ctx.emit({
    kind: 'css.declaration',
    loc: postcssLoc(decl),
    source,
    subject: {
      property,
      selector: selectorOf(decl),
      media: mediaOf(decl),
      owner_component: null,
      // Stylesheet declarations aren't bound to a single JSX element instance.
      element_id: null,
    },
    value: { raw, type: classifyCssValueType(property, raw) },
  });
}

/** Nearest enclosing rule selector, or `null` (e.g. top-level / at-rule body). */
function selectorOf(decl: Declaration): string | null {
  const parent = decl.parent;
  return parent && parent.type === 'rule' ? (parent as Rule).selector : null;
}

/** Nearest enclosing `@media` query params, or `null`. */
function mediaOf(decl: Declaration): string | null {
  let node: Container | Document | undefined = decl.parent;
  while (node) {
    if (node.type === 'atrule' && (node as AtRule).name.toLowerCase() === 'media') {
      return (node as AtRule).params;
    }
    node = node.parent;
  }
  return null;
}

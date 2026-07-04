/**
 * @factlas/plugin-styled — extract `css.declaration` facts from
 * styled-components / emotion tagged templates (source `css-in-js`).
 *
 * Recognizes `styled.tag`, `styled(Component)`, and emotion `css` tags in an
 * import-aware way (the base identifier must be imported from a known CSS-in-JS
 * package). The template is reconstructed with each `${interpolation}` replaced
 * by a placeholder and routed back through core's CSS parser; declarations whose
 * value contains an interpolation are emitted as honest `dynamic` facts, never
 * dropped.
 *
 * Phase 4 step 11.
 */

import type { NodePath, Scope } from '@babel/traverse';
import type {
  Expression,
  TaggedTemplateExpression,
  TemplateLiteral,
  V8IntrinsicIdentifier,
} from '@babel/types';
import { babelLoc, type DesignFactsPlugin, type PluginContext, traverse } from '@factlas/core';
import type { AtRule, Container, Declaration, Document, Rule } from 'postcss';
import { classifyCssValueType } from './classify-value.js';

export { classifyCssValueType } from './classify-value.js';

const NAME = '@factlas/plugin-styled';

import { readFileSync } from 'node:fs';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

/** Packages whose `styled`/`css` exports mark a tagged template as CSS-in-JS. */
const DEFAULT_SOURCES = new Set([
  'styled-components',
  '@emotion/styled',
  '@emotion/react',
  '@emotion/core',
]);

const PLACEHOLDER = /FACTLAS_EXPR_\d+/;

export interface StyledPluginOptions {
  /** Additional package names to treat as CSS-in-JS sources. */
  sources?: readonly string[];
}

/** Create the styled/emotion extractor plugin. */
export function styledPlugin(options: StyledPluginOptions = {}): DesignFactsPlugin {
  const sources = new Set([...DEFAULT_SOURCES, ...(options.sources ?? [])]);
  return {
    name: NAME,
    version: VERSION,
    analyzeProgram(ast, ctx) {
      traverse(ast, {
        TaggedTemplateExpression: (path) => analyzeTagged(path, sources, ctx),
      });
    },
  };
}

export default styledPlugin();

function analyzeTagged(
  path: NodePath<TaggedTemplateExpression>,
  sources: Set<string>,
  ctx: PluginContext,
): void {
  const base = baseIdentifier(path.node.tag);
  if (!base || !isFromSource(base, path.scope, sources)) return;

  const owner = ownerName(path);
  const css = templateToCss(path.node.quasi);
  const loc = babelLoc(path.node);

  let root: ReturnType<PluginContext['parseCss']>;
  try {
    root = ctx.parseCss(css);
  } catch (err) {
    ctx.diagnostic({
      reason: 'styled-parse-error',
      message: err instanceof Error ? err.message : String(err),
      loc,
      kind: 'css.declaration',
    });
    return;
  }

  root.walkDecls((decl) => {
    if (PLACEHOLDER.test(decl.prop)) {
      ctx.diagnostic({ reason: 'dynamic-styled-property', loc, kind: 'css.declaration' });
      return;
    }
    const isDynamic = PLACEHOLDER.test(decl.value);
    ctx.emit({
      kind: 'css.declaration',
      loc,
      source: 'css-in-js',
      subject: {
        property: decl.prop,
        selector: selectorOf(decl),
        media: mediaOf(decl),
        owner_component: owner,
        // A styled component defines CSS for a component, not one element instance.
        element_id: null,
      },
      value: isDynamic
        ? { raw: decl.value, type: 'dynamic', dynamic: true }
        : { raw: decl.value, type: classifyCssValueType(decl.prop, decl.value) },
      ...(isDynamic ? { diagnostic: 'styled-interpolation' } : {}),
    });
  });
}

/** Reconstruct CSS from a template, replacing interpolations with placeholders. */
function templateToCss(quasi: TemplateLiteral): string {
  let out = '';
  quasi.quasis.forEach((q, i) => {
    out += q.value.cooked ?? q.value.raw;
    if (i < quasi.expressions.length) out += `FACTLAS_EXPR_${i}`;
  });
  return out;
}

/** The base identifier of a styled/css tag (`styled`, `css`), or null. */
function baseIdentifier(tag: Expression | V8IntrinsicIdentifier): string | null {
  switch (tag.type) {
    case 'Identifier':
      return tag.name; // css`...`
    case 'MemberExpression':
      return tag.object.type === 'Identifier' ? tag.object.name : null; // styled.button`...`
    case 'CallExpression': {
      // Babel 8 widens callee to include Super/Import; we handle neither.
      const callee = tag.callee;
      if (callee.type === 'Super' || callee.type === 'Import') return null;
      return baseIdentifier(callee); // styled(Component)`...`, styled(x).attrs()`...`
    }
    default:
      return null;
  }
}

/** True if `name` is imported from a recognized CSS-in-JS package. */
function isFromSource(name: string, scope: Scope, sources: Set<string>): boolean {
  const binding = scope.getBinding(name);
  if (binding?.kind !== 'module') return false;
  const decl = binding.path.parent;
  return decl.type === 'ImportDeclaration' && sources.has(decl.source.value);
}

/** The variable a styled component is assigned to (`const Button = styled…`). */
function ownerName(path: NodePath<TaggedTemplateExpression>): string | null {
  const declarator = path.findParent((p) => p.isVariableDeclarator());
  const id = declarator?.isVariableDeclarator() ? declarator.node.id : null;
  return id && id.type === 'Identifier' ? id.name : null;
}

function selectorOf(decl: Declaration): string | null {
  const parent = decl.parent;
  return parent && parent.type === 'rule' ? (parent as Rule).selector : null;
}

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

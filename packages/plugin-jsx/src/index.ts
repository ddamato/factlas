/**
 * @factlas/plugin-jsx — extract `import`, `jsx.element`, `jsx.prop`, and
 * `jsx.attribute` facts from TS/TSX (source `babel-jsx`).
 *
 * This plugin completes the fact catalog beyond styling: it records imports
 * (allowed-packages policies), component usage (required/forbidden components),
 * and per-element props/attributes (prop enums, no-inline-style, forbidden
 * attrs). Attributes on **component** elements become `jsx.prop`; attributes on
 * **DOM** elements become `jsx.attribute`.
 *
 * Element linkage: each `jsx.prop`/`jsx.attribute` carries an `element_id` that
 * is the *content-addressed `fact_id`* of its owning `jsx.element`. That id is
 * computed by core's shared `jsxElementId`, so other plugins (e.g.
 * `plugin-tailwind`) reference the exact same element without a second pass.
 */

import { readFileSync } from 'node:fs';
import type { Scope } from '@babel/traverse';
import type { Expression, ImportDeclaration, JSXAttribute } from '@babel/types';
import {
  type DesignFactsPlugin,
  type ImportKind,
  type ImportMap,
  type PluginContext,
  type RawObservationValue,
  babelLoc,
  buildImportMap,
  jsxElementId,
  jsxElementIdentity,
  traverse,
} from '@factlas/core';

export const NAME = '@factlas/plugin-jsx';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

/** The JSX / import extractor plugin. */
export const jsxPlugin: DesignFactsPlugin = {
  name: NAME,
  version: VERSION,
  analyzeProgram(ast, ctx) {
    const imports = buildImportMap(ast);
    traverse(ast, {
      ImportDeclaration: (path) => emitImports(path.node, ctx),
    });
    traverse(ast, {
      JSXOpeningElement: (path) => analyzeElement(path.node, path.scope, imports, ctx),
    });
  },
};

export default jsxPlugin;

function emitImports(node: ImportDeclaration, ctx: PluginContext): void {
  const source = node.source.value;
  if (node.specifiers.length === 0) {
    // Side-effect import: `import './x.css'`.
    ctx.emit({
      kind: 'import',
      loc: babelLoc(node),
      source: 'babel-jsx',
      subject: { specifier: source, local: '', import_kind: 'side-effect' },
      value: { raw: source, type: 'module' },
    });
    return;
  }
  for (const spec of node.specifiers) {
    const kind: ImportKind =
      spec.type === 'ImportDefaultSpecifier'
        ? 'default'
        : spec.type === 'ImportNamespaceSpecifier'
          ? 'namespace'
          : 'named';
    ctx.emit({
      kind: 'import',
      loc: babelLoc(spec),
      source: 'babel-jsx',
      subject: { specifier: source, local: spec.local.name, import_kind: kind },
      value: { raw: source, type: 'module' },
    });
  }
}

function analyzeElement(
  node: import('@babel/types').JSXOpeningElement,
  scope: Scope,
  imports: ImportMap,
  ctx: PluginContext,
): void {
  const subject = jsxElementIdentity(node, imports);
  const loc = babelLoc(node);

  ctx.emit({ kind: 'jsx.element', loc, source: 'babel-jsx', subject });

  // Shared computation → matches the element's assembled fact_id exactly.
  const element_id = jsxElementId(node, ctx.file, imports);

  for (const attr of node.attributes) {
    if (attr.type !== 'JSXAttribute') {
      ctx.diagnostic({
        reason: 'spread-attribute',
        loc: babelLoc(attr),
        kind: subject.is_dom ? 'jsx.attribute' : 'jsx.prop',
      });
      continue;
    }
    const attribute = attrName(attr.name);
    const { value, diagnostic } = attrValue(attr, scope, ctx);
    if (subject.is_dom) {
      ctx.emit({
        kind: 'jsx.attribute',
        loc: babelLoc(attr),
        source: 'babel-jsx',
        subject: { owner: subject.name, attribute, element_id },
        value,
        ...(diagnostic ? { diagnostic } : {}),
      });
    } else {
      ctx.emit({
        kind: 'jsx.prop',
        loc: babelLoc(attr),
        source: 'babel-jsx',
        subject: { component: subject.name, prop: attribute, element_id },
        value,
        ...(diagnostic ? { diagnostic } : {}),
      });
    }
  }
}

/** Resolve an attribute's value into a raw observation + optional diagnostic. */
function attrValue(
  attr: JSXAttribute,
  scope: Scope,
  ctx: PluginContext,
): { value: RawObservationValue; diagnostic?: string } {
  const v = attr.value;
  // Boolean shorthand: `<Button disabled />` → true.
  if (v == null) return { value: { raw: 'true', type: 'keyword' } };
  if (v.type === 'StringLiteral') return { value: { raw: v.value, type: 'string' } };
  if (v.type !== 'JSXExpressionContainer' || v.expression.type === 'JSXEmptyExpression') {
    return { value: { raw: '', type: 'dynamic', dynamic: true }, diagnostic: 'empty-expression' };
  }

  const expr = v.expression as Expression;
  const raw = () => ctx.code.slice(expr.start ?? 0, expr.end ?? 0);
  const resolved = ctx.resolve(expr, scope);
  switch (resolved.status) {
    case 'literal': {
      const lit = resolved.value;
      if (typeof lit === 'number') return { value: { raw: String(lit), type: 'number' } };
      if (typeof lit === 'boolean') return { value: { raw: String(lit), type: 'keyword' } };
      return { value: { raw: lit, type: 'string' } };
    }
    case 'static-union':
      return { value: { raw: raw(), type: 'union' } };
    case 'dynamic':
      return { value: { raw: raw(), type: 'dynamic', dynamic: true }, diagnostic: resolved.reason };
    case 'unknown':
      return {
        value: { raw: raw(), type: 'string', certaintyHint: 'unknown' },
        diagnostic: resolved.reason,
      };
  }
}

function attrName(
  name: import('@babel/types').JSXIdentifier | import('@babel/types').JSXNamespacedName,
): string {
  return name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;
}

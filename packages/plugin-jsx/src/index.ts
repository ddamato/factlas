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
 * is the *content-addressed `fact_id`* of its owning `jsx.element`, computed here
 * with core's `computeFactId` so the two agree without a second pass. This
 * enables shallow compositional joins (e.g. a `Button` from `@acme/ui` that also
 * has a given prop).
 */

import type { Scope } from '@babel/traverse';
import type {
  Expression,
  ImportDeclaration,
  JSXAttribute,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXOpeningElement,
} from '@babel/types';
import {
  type DesignFactsPlugin,
  type ImportKind,
  type PluginContext,
  type RawObservationValue,
  babelLoc,
  computeFactId,
  traverse,
} from '@factlas/core';

export const NAME = '@factlas/plugin-jsx';
import { readFileSync } from 'node:fs';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

interface ImportBinding {
  source: string;
  kind: ImportKind;
}

/** The JSX / import extractor plugin. */
export const jsxPlugin: DesignFactsPlugin = {
  name: NAME,
  version: VERSION,
  analyzeProgram(ast, ctx) {
    const imports = new Map<string, ImportBinding>();
    traverse(ast, {
      ImportDeclaration: (path) => collectImports(path.node, imports, ctx),
    });
    traverse(ast, {
      JSXOpeningElement: (path) => analyzeElement(path.node, path.scope, imports, ctx),
    });
  },
};

export default jsxPlugin;

function collectImports(
  node: ImportDeclaration,
  imports: Map<string, ImportBinding>,
  ctx: PluginContext,
): void {
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
    const local = spec.local.name;
    imports.set(local, { source, kind });
    ctx.emit({
      kind: 'import',
      loc: babelLoc(spec),
      source: 'babel-jsx',
      subject: { specifier: source, local, import_kind: kind },
      value: { raw: source, type: 'module' },
    });
  }
}

function analyzeElement(
  node: JSXOpeningElement,
  scope: Scope,
  imports: Map<string, ImportBinding>,
  ctx: PluginContext,
): void {
  const name = jsxName(node.name);
  const is_dom = isIntrinsic(node.name);
  const imported_from = is_dom ? null : (imports.get(jsxBase(node.name))?.source ?? null);
  const subject = { name, imported_from, is_dom };
  const loc = babelLoc(node);

  ctx.emit({ kind: 'jsx.element', loc, source: 'babel-jsx', subject });

  // Same identity tuple core will hash → the element's fact_id, used as the FK.
  const element_id = computeFactId({
    kind: 'jsx.element',
    file: ctx.file,
    loc,
    subject,
    norm: null,
  });

  for (const attr of node.attributes) {
    if (attr.type !== 'JSXAttribute') {
      ctx.diagnostic({
        reason: 'spread-attribute',
        loc: babelLoc(attr),
        kind: is_dom ? 'jsx.attribute' : 'jsx.prop',
      });
      continue;
    }
    const attribute = attrName(attr.name);
    const { value, diagnostic } = attrValue(attr, scope, ctx);
    if (is_dom) {
      ctx.emit({
        kind: 'jsx.attribute',
        loc: babelLoc(attr),
        source: 'babel-jsx',
        subject: { owner: name, attribute, element_id },
        value,
        ...(diagnostic ? { diagnostic } : {}),
      });
    } else {
      ctx.emit({
        kind: 'jsx.prop',
        loc: babelLoc(attr),
        source: 'babel-jsx',
        subject: { component: name, prop: attribute, element_id },
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

/** Intrinsic (DOM) elements: lowercase identifiers and namespaced tags. */
function isIntrinsic(name: JSXOpeningElement['name']): boolean {
  if (name.type === 'JSXIdentifier') return /^[a-z]/.test(name.name);
  if (name.type === 'JSXNamespacedName') return true;
  return false; // JSXMemberExpression (e.g. <Foo.Bar>) is always a component
}

function jsxName(name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`;
    case 'JSXMemberExpression':
      return `${jsxName(name.object)}.${name.property.name}`;
  }
}

/** Leftmost identifier of a JSX name, for import lookup. */
function jsxBase(name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return name.namespace.name;
    case 'JSXMemberExpression':
      return jsxBase(name.object);
  }
}

function attrName(name: JSXIdentifier | JSXNamespacedName): string {
  return name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;
}

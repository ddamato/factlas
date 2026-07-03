/**
 * @factlas/plugin-inline-style — extract `css.declaration` facts from JSX
 * `style={{ ... }}` objects (source `inline`).
 *
 * Walks each JSX element's `style` object and emits one observation per
 * property, resolving each value with the bounded resolver: literals become
 * literal facts, conditional literals become `union`s, and anything unresolved
 * becomes an honest `dynamic`/`unknown` with a diagnostic. Property keys stay in
 * their authored (camelCase) form; core canonicalizes them to kebab-case so an
 * inline `backgroundColor` and a stylesheet `background-color` collapse.
 *
 * This is a bundled default plugin (ADR §2.2 / §3 Phase 4 step 10).
 */

import type { Scope } from '@babel/traverse';
import type {
  Expression,
  JSXAttribute,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXOpeningElement,
  ObjectProperty,
} from '@babel/types';
import {
  type DesignFactsPlugin,
  type PluginContext,
  type RawObservationValue,
  babelLoc,
  traverse,
} from '@factlas/core';
import { classifyCssValueType } from './classify-value.js';

export { classifyCssValueType } from './classify-value.js';

const NAME = '@factlas/plugin-inline-style';
import { readFileSync } from 'node:fs';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

/** The inline-style extractor plugin. */
export const inlineStylePlugin: DesignFactsPlugin = {
  name: NAME,
  version: VERSION,
  analyzeProgram(ast, ctx) {
    traverse(ast, {
      JSXOpeningElement: (path) => analyzeElement(path.node, path.scope, ctx),
    });
  },
};

export default inlineStylePlugin;

function analyzeElement(node: JSXOpeningElement, scope: Scope, ctx: PluginContext): void {
  const owner = jsxName(node.name);
  for (const attr of node.attributes) {
    if (attr.type !== 'JSXAttribute' || attrName(attr.name) !== 'style') continue;
    analyzeStyleAttribute(attr, owner, scope, ctx);
  }
}

function analyzeStyleAttribute(
  attr: JSXAttribute,
  owner: string,
  scope: Scope,
  ctx: PluginContext,
): void {
  const value = attr.value;
  if (!value || value.type !== 'JSXExpressionContainer') return;
  const expr = value.expression;
  if (expr.type !== 'ObjectExpression') {
    ctx.diagnostic({
      reason: 'dynamic-style-object',
      loc: babelLoc(attr),
      kind: 'css.declaration',
    });
    return;
  }
  for (const prop of expr.properties) {
    if (prop.type !== 'ObjectProperty') {
      ctx.diagnostic({
        reason: 'non-property-in-style',
        loc: babelLoc(prop),
        kind: 'css.declaration',
      });
      continue;
    }
    if (prop.computed) {
      ctx.diagnostic({
        reason: 'computed-style-key',
        loc: babelLoc(prop),
        kind: 'css.declaration',
      });
      continue;
    }
    emitDeclaration(prop, owner, scope, ctx);
  }
}

function emitDeclaration(
  prop: ObjectProperty,
  owner: string,
  scope: Scope,
  ctx: PluginContext,
): void {
  const property = keyName(prop.key);
  if (property === null) return;
  const valueNode = prop.value as Expression;
  const { value, diagnostic } = observeValue(property, valueNode, scope, ctx);
  ctx.emit({
    kind: 'css.declaration',
    loc: babelLoc(prop),
    source: 'inline',
    subject: { property, selector: null, media: null, owner_component: owner },
    value,
    ...(diagnostic ? { diagnostic } : {}),
  });
}

/** Resolve an inline value into a raw observation + optional diagnostic. */
function observeValue(
  property: string,
  node: Expression,
  scope: Scope,
  ctx: PluginContext,
): { value: RawObservationValue; diagnostic?: string } {
  const resolved = ctx.resolve(node, scope);
  const rawText = () => ctx.code.slice(node.start ?? 0, node.end ?? 0);

  switch (resolved.status) {
    case 'literal': {
      const lit = resolved.value;
      if (typeof lit === 'number') return { value: { raw: String(lit), type: 'number' } };
      const s = String(lit);
      return { value: { raw: s, type: classifyCssValueType(property, s) } };
    }
    case 'static-union':
      return { value: { raw: rawText(), type: 'union' } };
    case 'dynamic':
      return {
        value: { raw: rawText(), type: 'dynamic', dynamic: true },
        diagnostic: resolved.reason,
      };
    case 'unknown':
      return {
        value: { raw: rawText(), type: 'keyword', certaintyHint: 'unknown' },
        diagnostic: resolved.reason,
      };
  }
}

function keyName(key: ObjectProperty['key']): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function attrName(name: JSXIdentifier | JSXNamespacedName): string {
  return name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;
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

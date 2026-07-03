/**
 * @factlas/plugin-tailwind — extract `css.class` facts from Tailwind usage.
 *
 * Collects class tokens from `className`/`class` attributes and from class
 * combiners (`cn`, `clsx`, `classnames`, `cva`, `twMerge`, `cx`), including
 * literal tokens pulled out of conditional expressions and objects as
 * `static-union` (ADR §2.5). Each token becomes a `css.class` fact carrying its
 * utility namespace and whether it uses an arbitrary value; anything unresolved
 * becomes a diagnostic, never a silent drop.
 *
 * **v1 scope:** this extracts and structures class usage (which powers
 * "no-arbitrary-values" and "known-class" policies). Full resolution of a class
 * to its CSS declarations via the Tailwind engine is planned future work;
 * `tailwindcss` is therefore an optional peer, and `tailwind.config.*` should be
 * passed to `discover({ configFiles })` so a config change invalidates caches.
 *
 * Phase 4 step 12.
 */

import { readFileSync } from 'node:fs';
import type { Scope } from '@babel/traverse';
import type {
  Expression,
  JSXIdentifier,
  JSXNamespacedName,
  JSXOpeningElement,
  Node,
} from '@babel/types';
import {
  babelLoc,
  buildImportMap,
  type DesignFactsPlugin,
  jsxElementId,
  type Loc,
  type PluginContext,
  traverse,
} from '@factlas/core';
import { classifyArbitrary, parseToken } from './token.js';

export { classifyArbitrary, parseToken } from './token.js';

const NAME = '@factlas/plugin-tailwind';

// Producer version is read from this package's own package.json so it can never
// drift from the published version (resolves the same in dist/ and src/).
const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

/** Call expressions whose string arguments are class-name sources. */
const DEFAULT_COMBINERS = new Set([
  'cn',
  'clsx',
  'classnames',
  'classNames',
  'twMerge',
  'cx',
  'tw',
]);

/** `cva` gets its own visitor: it defines variants outside `className`. */
const CVA = 'cva';

/** A class token discovered during collection. */
interface CollectedToken {
  token: string;
  /** True when the token is only conditionally applied (→ `static-union`). */
  union: boolean;
}

export interface TailwindPluginOptions {
  /** Additional class-combiner callee names to recognize. */
  combiners?: readonly string[];
}

/** Create the Tailwind class extractor plugin. */
export function tailwindPlugin(options: TailwindPluginOptions = {}): DesignFactsPlugin {
  const combiners = new Set([...DEFAULT_COMBINERS, ...(options.combiners ?? [])]);
  return {
    name: NAME,
    version: VERSION,
    analyzeProgram(ast, ctx) {
      const imports = buildImportMap(ast);
      traverse(ast, {
        JSXAttribute: (path) => {
          const name = attrName(path.node.name);
          if (name !== 'className' && name !== 'class') return;
          const value = path.node.value;
          if (!value) return;
          // Link each class to its owning element (same id core assigns the
          // jsx.element), so a className joins back to <Button imported_from=…>.
          const parent = path.parent;
          const elementId =
            parent.type === 'JSXOpeningElement'
              ? jsxElementId(parent as JSXOpeningElement, ctx.file, imports)
              : null;
          const loc = babelLoc(value);
          const tokens: CollectedToken[] = [];
          if (value.type === 'StringLiteral') {
            pushTokens(tokens, value.value, false);
          } else if (
            value.type === 'JSXExpressionContainer' &&
            value.expression.type !== 'JSXEmptyExpression'
          ) {
            collect(value.expression, false, path.scope, combiners, ctx, tokens);
          }
          for (const t of dedupe(tokens)) emitToken(t, loc, elementId, ctx);
        },
        // cva defines class variants outside a className attribute; collect them
        // wherever they appear. Every cva class is conditionally applied and has
        // no owning element.
        CallExpression: (path) => {
          const callee = path.node.callee;
          if (callee.type !== 'Identifier' || callee.name !== CVA) return;
          const tokens: CollectedToken[] = [];
          for (const arg of path.node.arguments) {
            if (arg.type !== 'SpreadElement') {
              collect(arg as Expression, true, path.scope, combiners, ctx, tokens);
            }
          }
          const loc = babelLoc(path.node);
          for (const t of dedupe(tokens)) emitToken(t, loc, null, ctx);
        },
      });
    },
  };
}

export default tailwindPlugin();

/** Recursively collect class tokens from an expression. */
function collect(
  node: Expression,
  union: boolean,
  scope: Scope,
  combiners: Set<string>,
  ctx: PluginContext,
  out: CollectedToken[],
): void {
  switch (node.type) {
    case 'StringLiteral':
      pushTokens(out, node.value, union);
      return;

    case 'TemplateLiteral': {
      for (const q of node.quasis) pushTokens(out, q.value.cooked ?? q.value.raw, union);
      if (node.expressions.length > 0) {
        ctx.diagnostic({
          reason: 'dynamic-classname-segment',
          loc: babelLoc(node),
          kind: 'css.class',
        });
      }
      return;
    }

    case 'ConditionalExpression':
      collect(node.consequent, true, scope, combiners, ctx, out);
      collect(node.alternate, true, scope, combiners, ctx, out);
      return;

    case 'LogicalExpression':
      collect(node.left as Expression, true, scope, combiners, ctx, out);
      collect(node.right as Expression, true, scope, combiners, ctx, out);
      return;

    case 'ArrayExpression':
      for (const el of node.elements) {
        if (el && el.type !== 'SpreadElement')
          collect(el as Expression, union, scope, combiners, ctx, out);
      }
      return;

    case 'ObjectExpression':
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty') continue;
        // clsx object form: class-like keys are conditionally-applied tokens.
        const key = objectKey(prop.key);
        if (key !== null && looksLikeClass(key)) pushTokens(out, key, true);
        // cva form: class strings live in the values.
        collect(prop.value as Expression, true, scope, combiners, ctx, out);
      }
      return;

    case 'CallExpression': {
      const callee = node.callee;
      const name = callee.type === 'Identifier' ? callee.name : null;
      if (name && combiners.has(name)) {
        for (const arg of node.arguments) {
          if (arg.type !== 'SpreadElement')
            collect(arg as Expression, union, scope, combiners, ctx, out);
        }
      } else {
        ctx.diagnostic({
          reason: 'dynamic-classname-call',
          loc: babelLoc(node),
          kind: 'css.class',
        });
      }
      return;
    }

    case 'Identifier': {
      const resolved = ctx.resolve(node, scope);
      if (resolved.status === 'literal' && typeof resolved.value === 'string') {
        pushTokens(out, resolved.value, union);
      } else if (resolved.status === 'static-union') {
        for (const v of resolved.values) if (typeof v === 'string') pushTokens(out, v, true);
      } else {
        ctx.diagnostic({
          reason: resolved.status === 'dynamic' ? 'dynamic-classname' : 'unknown-classname',
          loc: babelLoc(node),
          kind: 'css.class',
        });
      }
      return;
    }

    default:
      ctx.diagnostic({ reason: 'dynamic-classname', loc: babelLoc(node), kind: 'css.class' });
  }
}

function emitToken(
  t: CollectedToken,
  loc: Loc,
  elementId: string | null,
  ctx: PluginContext,
): void {
  const parsed = parseToken(t.token);
  const value = parsed.is_arbitrary
    ? { raw: parsed.arbitrary as string, type: classifyArbitrary(parsed.arbitrary as string) }
    : { raw: t.token, type: 'keyword' as const };
  ctx.emit({
    kind: 'css.class',
    loc,
    source: 'tailwind',
    subject: {
      token: parsed.token,
      utility: parsed.utility,
      is_arbitrary: parsed.is_arbitrary,
      element_id: elementId,
    },
    value: t.union ? { ...value, certaintyHint: 'static-union' } : value,
  });
}

function pushTokens(out: CollectedToken[], raw: string, union: boolean): void {
  for (const token of raw.split(/\s+/)) {
    if (token) out.push({ token, union });
  }
}

/** Dedupe by token, keeping the strongest certainty (literal beats union). */
function dedupe(tokens: CollectedToken[]): CollectedToken[] {
  const byToken = new Map<string, CollectedToken>();
  for (const t of tokens) {
    const prev = byToken.get(t.token);
    if (!prev) byToken.set(t.token, t);
    else if (prev.union && !t.union) byToken.set(t.token, t);
  }
  return [...byToken.values()];
}

function looksLikeClass(key: string): boolean {
  return /[-:/[]/.test(key);
}

function objectKey(key: Node): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function attrName(name: JSXIdentifier | JSXNamespacedName): string {
  return name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;
}

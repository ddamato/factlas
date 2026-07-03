/**
 * Bounded resolver (ADR §2.4 rule 5, Phase 2 step 5).
 *
 * Statically resolves an expression to a literal, a static union of literals, or
 * an honest `dynamic`/`unknown` with a reason — **never** by executing code.
 * The budget is deliberately tiny: one binding hop, literals only, no descent
 * into imported (cross-file / `node_modules`) bindings, no function evaluation.
 * Anything past the budget degrades to `unknown` so nothing is dropped silently.
 */

import type { Scope } from '@babel/traverse';
import type { Node } from '@babel/types';

/** A statically resolved primitive. */
export type Literal = string | number | boolean;

/** Outcome of {@link resolveExpression}. */
export type ResolveResult =
  | { status: 'literal'; value: Literal }
  | { status: 'static-union'; values: Literal[] }
  | { status: 'dynamic'; reason: string }
  | { status: 'unknown'; reason: string };

/** Default resolution budget: a single binding hop. */
export const DEFAULT_HOPS = 1;

/**
 * Resolve `node` within `scope`, consuming at most `hops` binding lookups.
 * Pure and side-effect free.
 */
export function resolveExpression(
  node: Node,
  scope?: Scope,
  hops: number = DEFAULT_HOPS,
): ResolveResult {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return { status: 'literal', value: node.value };

    case 'TemplateLiteral': {
      if (node.expressions.length === 0) {
        const value = node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
        return { status: 'literal', value };
      }
      return { status: 'dynamic', reason: 'template-with-expressions' };
    }

    case 'ConditionalExpression':
      return unionOf([
        resolveExpression(node.consequent, scope, hops),
        resolveExpression(node.alternate, scope, hops),
      ]);

    case 'LogicalExpression':
      // `cond && 'a'`, `x || 'b'` — the operand literals form a static union.
      return unionOf([
        resolveExpression(node.left, scope, hops),
        resolveExpression(node.right, scope, hops),
      ]);

    case 'ParenthesizedExpression':
      return resolveExpression(node.expression, scope, hops);

    case 'Identifier': {
      if (hops <= 0 || !scope) return { status: 'unknown', reason: 'resolution-budget-exhausted' };
      const binding = scope.getBinding(node.name);
      if (!binding) return { status: 'unknown', reason: 'unbound-identifier' };
      // Never cross module boundaries (no node_modules, no other files).
      if (binding.kind === 'module') return { status: 'unknown', reason: 'imported-binding' };
      if (binding.kind !== 'const') return { status: 'dynamic', reason: 'mutable-binding' };
      const decl = binding.path.node;
      if (decl.type === 'VariableDeclarator' && decl.init) {
        return resolveExpression(decl.init, binding.scope, hops - 1);
      }
      return { status: 'unknown', reason: 'no-initializer' };
    }

    default:
      return { status: 'dynamic', reason: `unsupported-node:${node.type}` };
  }
}

/** Combine branch results into a single result (used for unions/conditionals). */
function unionOf(parts: ResolveResult[]): ResolveResult {
  const values: Literal[] = [];
  for (const part of parts) {
    if (part.status === 'literal') values.push(part.value);
    else if (part.status === 'static-union') values.push(...part.values);
    // A single unresolved branch makes the whole expression un-judgeable.
    else return part;
  }
  const deduped = dedupe(values);
  if (deduped.length === 1) return { status: 'literal', value: deduped[0] as Literal };
  return { status: 'static-union', values: deduped };
}

/** Stable dedupe preserving first-seen order. */
function dedupe(values: Literal[]): Literal[] {
  const seen = new Set<string>();
  const out: Literal[] = [];
  for (const v of values) {
    const key = `${typeof v}:${String(v)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

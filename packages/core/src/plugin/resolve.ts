/**
 * Bounded resolver.
 *
 * Statically resolves an expression to a literal, a static union of literals, or
 * an honest `dynamic`/`unknown` with a reason — **never** by executing code.
 * The budget is deliberately tiny: one binding hop, literals only, no descent
 * into imported (cross-file / `node_modules`) bindings, no function evaluation.
 * Anything past the budget degrades to `unknown` so nothing is dropped silently.
 */

import type { Scope } from '@babel/traverse';
import type { Expression, Node, ObjectExpression } from '@babel/types';

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

    case 'UnaryExpression': {
      // Numeric sign only: `-4`, `+8`. Everything else (`!x`, `typeof`) is dynamic.
      if (node.operator === '-' || node.operator === '+') {
        const inner = resolveExpression(node.argument, scope, hops);
        if (inner.status === 'literal' && typeof inner.value === 'number') {
          return { status: 'literal', value: node.operator === '-' ? -inner.value : inner.value };
        }
      }
      return { status: 'dynamic', reason: `unsupported-unary:${node.operator}` };
    }

    case 'OptionalMemberExpression':
    case 'MemberExpression':
      // `sizes.sm` / `sizes['sm']` → the property's literal; `sizes[dynamic]` →
      // the static union of all the object's literal values. Bounded: the object
      // must be an in-file `const` object literal (one hop), and its values must
      // themselves be literals (no further hops).
      return resolveMember(node.object, node.property, node.computed, scope, hops);

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

/**
 * Resolve `object[property]` against an in-file object literal. A statically
 * known key yields that property's value; a dynamic key yields the static union
 * of every property's value. Anything outside the budget degrades honestly.
 */
function resolveMember(
  object: Node,
  property: Node,
  computed: boolean,
  scope: Scope | undefined,
  hops: number,
): ResolveResult {
  const resolved = objectLiteralOf(object, scope, hops);
  if (!resolved) return { status: 'unknown', reason: 'member-object-unresolved' };
  const { obj, scope: objScope } = resolved;

  // Any spread means we can't enumerate the object's keys exhaustively.
  if (obj.properties.some((p) => p.type === 'SpreadElement')) {
    return { status: 'unknown', reason: 'member-object-has-spread' };
  }

  const key = staticKey(property, computed);
  if (key !== null) {
    const match = obj.properties.find(
      (p) => p.type === 'ObjectProperty' && !p.computed && propertyKey(p.key) === key,
    );
    if (match?.type !== 'ObjectProperty') {
      return { status: 'unknown', reason: 'member-key-missing' };
    }
    // Values must themselves be literals (hops-1): a single hop reached the object.
    return resolveExpression(match.value as Expression, objScope, hops - 1);
  }

  // Dynamic key → union of all property values (each must resolve to a literal).
  const parts: ResolveResult[] = [];
  for (const p of obj.properties) {
    if (p.type !== 'ObjectProperty')
      return { status: 'unknown', reason: 'member-non-data-property' };
    parts.push(resolveExpression(p.value as Expression, objScope, hops - 1));
  }
  if (parts.length === 0) return { status: 'unknown', reason: 'member-empty-object' };
  return unionOf(parts);
}

/** Resolve `node` to an in-file `const` object literal (one hop), or `null`. */
function objectLiteralOf(
  node: Node,
  scope: Scope | undefined,
  hops: number,
): { obj: ObjectExpression; scope: Scope | undefined } | null {
  if (node.type === 'ObjectExpression') return { obj: node, scope };
  if (node.type !== 'Identifier') return null;
  if (hops <= 0 || !scope) return null;
  const binding = scope.getBinding(node.name);
  // Never cross module boundaries; require an immutable in-file object literal.
  if (!binding || binding.kind === 'module' || binding.kind !== 'const') return null;
  const decl = binding.path.node;
  if (decl.type === 'VariableDeclarator' && decl.init?.type === 'ObjectExpression') {
    return { obj: decl.init, scope: binding.scope };
  }
  return null;
}

/** A statically-known member key, or `null` for a dynamic key. */
function staticKey(property: Node, computed: boolean): string | null {
  if (!computed) return property.type === 'Identifier' ? property.name : null;
  if (property.type === 'StringLiteral') return property.value;
  if (property.type === 'NumericLiteral') return String(property.value);
  return null;
}

/** The literal key of an object property, or `null` if not statically keyed. */
function propertyKey(key: Node): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  if (key.type === 'NumericLiteral') return String(key.value);
  return null;
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

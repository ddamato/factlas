import type { Scope } from '@babel/traverse';
import type { Expression } from '@babel/types';
import { describe, expect, it } from 'vitest';
import { parseModule, traverse } from '../parse/babel.js';
import { resolveExpression } from './resolve.js';

/**
 * Parse a module and return the initializer expression of `const/let x = …`
 * together with the scope it lives in — enough to exercise binding resolution.
 */
function initOfX(code: string): { node: Expression; scope: Scope } {
  const { ast } = parseModule(code, 'test.ts');
  let found: { node: Expression; scope: Scope } | undefined;
  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      if (id.type === 'Identifier' && id.name === 'x' && path.node.init) {
        found = { node: path.node.init, scope: path.scope };
      }
    },
  });
  if (!found) throw new Error('no `x` declarator found');
  return found;
}

describe('resolveExpression', () => {
  it('resolves string/number/boolean literals', () => {
    expect(resolveExpression(initOfX('const x = "primary";').node)).toEqual({
      status: 'literal',
      value: 'primary',
    });
    expect(resolveExpression(initOfX('const x = 4;').node)).toEqual({
      status: 'literal',
      value: 4,
    });
    expect(resolveExpression(initOfX('const x = true;').node)).toEqual({
      status: 'literal',
      value: true,
    });
  });

  it('resolves a template literal with no expressions', () => {
    expect(resolveExpression(initOfX('const x = `foo`;').node)).toEqual({
      status: 'literal',
      value: 'foo',
    });
  });

  it('marks a template literal with expressions as dynamic', () => {
    const r = resolveExpression(initOfX('const x = `foo${y}`;').node);
    expect(r).toEqual({ status: 'dynamic', reason: 'template-with-expressions' });
  });

  it('treats a conditional over literals as a static union', () => {
    const r = resolveExpression(initOfX("const x = cond ? 'a' : 'b';").node);
    expect(r).toEqual({ status: 'static-union', values: ['a', 'b'] });
  });

  it('collapses a conditional with equal branches to one literal', () => {
    const r = resolveExpression(initOfX("const x = cond ? 'a' : 'a';").node);
    expect(r).toEqual({ status: 'literal', value: 'a' });
  });

  it('resolves an identifier one hop to a const literal (with scope)', () => {
    const { node, scope } = initOfX("const c = 'primary';\nconst x = c;");
    expect(resolveExpression(node, scope)).toEqual({ status: 'literal', value: 'primary' });
  });

  it('returns unknown for an identifier without scope (budget)', () => {
    const { node } = initOfX("const c = 'primary';\nconst x = c;");
    expect(resolveExpression(node)).toEqual({
      status: 'unknown',
      reason: 'resolution-budget-exhausted',
    });
  });

  it('does not cross a second hop', () => {
    // x -> b -> 'deep' would need two hops; budget is one.
    const { node, scope } = initOfX("const a = 'deep';\nconst b = a;\nconst x = b;");
    const r = resolveExpression(node, scope);
    expect(r.status).toBe('unknown');
  });

  it('marks a mutable (let) binding as dynamic', () => {
    const { node, scope } = initOfX("let m = 'a';\nconst x = m;");
    expect(resolveExpression(node, scope)).toEqual({
      status: 'dynamic',
      reason: 'mutable-binding',
    });
  });

  it('never crosses a module (imported) binding', () => {
    const { node, scope } = initOfX("import { z } from 'pkg';\nconst x = z;");
    expect(resolveExpression(node, scope)).toEqual({
      status: 'unknown',
      reason: 'imported-binding',
    });
  });

  it('returns unknown for an unbound identifier', () => {
    const { node, scope } = initOfX('const x = undefinedName;');
    expect(resolveExpression(node, scope)).toEqual({
      status: 'unknown',
      reason: 'unbound-identifier',
    });
  });

  it('resolves a numeric sign (unary minus/plus)', () => {
    expect(resolveExpression(initOfX('const x = -4;').node)).toEqual({
      status: 'literal',
      value: -4,
    });
    expect(resolveExpression(initOfX('const x = +8;').node)).toEqual({
      status: 'literal',
      value: 8,
    });
  });

  it('marks a non-numeric unary as dynamic', () => {
    expect(resolveExpression(initOfX('const x = !flag;').node)).toEqual({
      status: 'dynamic',
      reason: 'unsupported-unary:!',
    });
  });

  describe('member access', () => {
    it('resolves a static property of an in-file const object to its literal', () => {
      const { node, scope } = initOfX(
        "const sizes = { sm: '4px', lg: '8px' };\nconst x = sizes.sm;",
      );
      expect(resolveExpression(node, scope)).toEqual({ status: 'literal', value: '4px' });
    });

    it('resolves a computed string-literal key', () => {
      const { node, scope } = initOfX("const sizes = { sm: '4px' };\nconst x = sizes['sm'];");
      expect(resolveExpression(node, scope)).toEqual({ status: 'literal', value: '4px' });
    });

    it('resolves a member of an inline object literal', () => {
      const { node, scope } = initOfX("const x = ({ a: '1px', b: '2px' }).b;");
      expect(resolveExpression(node, scope)).toEqual({ status: 'literal', value: '2px' });
    });

    it('models a dynamic key as the static union of all values', () => {
      const { node, scope } = initOfX(
        "const sizes = { sm: '4px', lg: '8px' };\nconst x = sizes[k];",
      );
      expect(resolveExpression(node, scope)).toEqual({
        status: 'static-union',
        values: ['4px', '8px'],
      });
    });

    it('is unknown when a static key is missing', () => {
      const { node, scope } = initOfX("const sizes = { sm: '4px' };\nconst x = sizes.md;");
      expect(resolveExpression(node, scope)).toEqual({
        status: 'unknown',
        reason: 'member-key-missing',
      });
    });

    it('is unknown for a member of an imported object (never crosses modules)', () => {
      const { node, scope } = initOfX("import tokens from 'tokens';\nconst x = tokens.sm;");
      expect(resolveExpression(node, scope)).toEqual({
        status: 'unknown',
        reason: 'member-object-unresolved',
      });
    });

    it('is unknown when the object spreads (keys not enumerable)', () => {
      const { node, scope } = initOfX(
        "const base = {};\nconst sizes = { ...base, sm: '4px' };\nconst x = sizes[k];",
      );
      expect(resolveExpression(node, scope)).toEqual({
        status: 'unknown',
        reason: 'member-object-has-spread',
      });
    });

    it('does not resolve non-literal property values (values must be literals)', () => {
      const { node, scope } = initOfX(
        "const v = '4px';\nconst sizes = { sm: v };\nconst x = sizes.sm;",
      );
      // Reaching the object consumed the single hop; the value identifier can't.
      expect(resolveExpression(node, scope).status).toBe('unknown');
    });
  });
});

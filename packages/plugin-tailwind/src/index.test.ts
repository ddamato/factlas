import { assembleFacts, extractFile } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import tailwind, { classifyArbitrary, parseToken, tailwindPlugin } from './index.js';

function classFacts(code: string, file = 'src/Button.tsx') {
  return assembleFacts(extractFile({ file, code, plugins: [tailwind] })).filter(
    (f) => f.kind === 'css.class',
  );
}

describe('parseToken', () => {
  it('parses utility, variants, and arbitrary values', () => {
    expect(parseToken('bg-red-500')).toMatchObject({ utility: 'bg', is_arbitrary: false });
    expect(parseToken('hover:md:text-lg')).toMatchObject({ utility: 'text', is_arbitrary: false });
    expect(parseToken('text-[#123456]')).toMatchObject({
      utility: 'text',
      is_arbitrary: true,
      arbitrary: '#123456',
    });
    expect(parseToken('-mt-2')).toMatchObject({ utility: '-mt' });
    expect(parseToken('[&:hover]:text-red-500')).toMatchObject({
      utility: 'text',
      is_arbitrary: false,
    });
  });
});

describe('classifyArbitrary', () => {
  it('types by shape', () => {
    expect(classifyArbitrary('#fff')).toBe('color');
    expect(classifyArbitrary('13px')).toBe('length');
    expect(classifyArbitrary('3')).toBe('number');
    expect(classifyArbitrary('calc(100%-1px)')).toBe('keyword');
  });
});

describe('tailwindPlugin', () => {
  it('extracts tokens from a className string literal', () => {
    const facts = classFacts('export const B = () => <div className="bg-red-500 text-white" />;');
    expect(facts).toHaveLength(2);
    // Tokens share a location, so output order is by fact_id (deterministic,
    // not source order) — assert as a set.
    expect(new Set(facts.map((f) => (f.kind === 'css.class' ? f.subject.token : '')))).toEqual(
      new Set(['bg-red-500', 'text-white']),
    );
    expect(facts.every((f) => f.certainty === 'literal')).toBe(true);
  });

  it('flags arbitrary values with a typed value', () => {
    const facts = classFacts('export const B = () => <div className="text-[#123456]" />;');
    expect(facts).toHaveLength(1);
    if (facts[0]?.kind === 'css.class') {
      expect(facts[0].subject.is_arbitrary).toBe(true);
      expect(facts[0].value.type).toBe('color');
      expect(facts[0].value.norm).toBe('#123456');
    }
  });

  it('collects literal tokens from cn/clsx conditionals as static-union', () => {
    const facts = classFacts(
      'export const B = ({ x }) => <div className={cn("base", x ? "text-red-500" : "text-blue-500")} />;',
    );
    const tokens = facts.map((f) => (f.kind === 'css.class' ? f.subject.token : ''));
    expect(tokens).toContain('base');
    expect(tokens).toContain('text-red-500');
    expect(tokens).toContain('text-blue-500');
    const base = facts.find((f) => f.kind === 'css.class' && f.subject.token === 'base');
    const cond = facts.find((f) => f.kind === 'css.class' && f.subject.token === 'text-red-500');
    expect(base?.certainty).toBe('literal');
    expect(cond?.certainty).toBe('static-union');
  });

  it('handles the clsx object form (class-like keys)', () => {
    const facts = classFacts(
      'export const B = ({ on }) => <div className={clsx({ "bg-red-500": on })} />;',
    );
    expect(facts.some((f) => f.kind === 'css.class' && f.subject.token === 'bg-red-500')).toBe(
      true,
    );
  });

  it('collects cva variant class strings', () => {
    const facts = classFacts(
      'const v = cva("base", { variants: { size: { sm: "text-sm", lg: "text-lg" } } });',
    );
    const tokens = facts.map((f) => (f.kind === 'css.class' ? f.subject.token : ''));
    expect(tokens).toEqual(expect.arrayContaining(['base', 'text-sm', 'text-lg']));
  });

  it('diagnoses a fully dynamic className', () => {
    const extracted = extractFile({
      file: 'x.tsx',
      code: 'export const B = ({ cls }) => <div className={cls} />;',
      plugins: [tailwind],
    });
    expect(extracted.observations).toHaveLength(0);
    expect(extracted.diagnostics.some((d) => d.kind === 'css.class')).toBe(true);
  });

  it('accepts additional combiners', () => {
    const plugin = tailwindPlugin({ combiners: ['myCx'] });
    const facts = assembleFacts(
      extractFile({
        file: 'x.tsx',
        code: 'export const B = () => <div className={myCx("flex")} />;',
        plugins: [plugin],
      }),
    ).filter((f) => f.kind === 'css.class');
    expect(facts).toHaveLength(1);
  });
});

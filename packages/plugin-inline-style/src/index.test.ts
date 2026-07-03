import { assembleFacts, extractFile } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import inlineStyle from './index.js';

function facts(code: string, file = 'src/Button.tsx') {
  return assembleFacts(extractFile({ file, code, plugins: [inlineStyle] }));
}

describe('inlineStylePlugin', () => {
  it('extracts literal declarations with canonicalized property + owner', () => {
    const result = facts('export const B = () => <div style={{ backgroundColor: "#FFF" }} />;');
    expect(result).toHaveLength(1);
    const fact = result[0];
    expect(fact?.kind).toBe('css.declaration');
    if (fact?.kind === 'css.declaration') {
      expect(fact.source).toBe('inline');
      expect(fact.subject.property).toBe('background-color'); // camelCase → kebab by core
      expect(fact.subject.owner_component).toBe('div');
      expect(fact.value.norm).toBe('#ffffff');
      expect(fact.certainty).toBe('literal');
    }
  });

  it('resolves a one-hop const reference', () => {
    const result = facts('const c = "red";\nexport const B = () => <span style={{ color: c }} />;');
    expect(result).toHaveLength(1);
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].value.norm).toBe('#ff0000');
      expect(result[0].certainty).toBe('literal');
    }
  });

  it('marks a runtime prop value dynamic with norm null', () => {
    // A destructured prop is a function-param binding → a runtime (dynamic) value.
    const result = facts('export const B = ({ c }) => <span style={{ color: c }} />;');
    expect(result).toHaveLength(1);
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].certainty).toBe('dynamic');
      expect(result[0].value.norm).toBeNull();
      expect(result[0].diagnostic).toBeTruthy();
    }
  });

  it('marks a truly unresolvable value unknown', () => {
    // A bare free identifier has no binding → unknown, not dynamic.
    const result = facts('export const B = () => <span style={{ color: mystery }} />;');
    expect(result).toHaveLength(1);
    expect(result[0]?.certainty).toBe('unknown');
  });

  it('treats a conditional of literals as a static-union', () => {
    const result = facts(
      'export const B = ({ x }) => <span style={{ color: x ? "red" : "blue" }} />;',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.certainty).toBe('static-union');
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].value.norm).toBeNull();
    }
  });

  it('diagnoses a fully dynamic style object without emitting a fact', () => {
    const extracted = extractFile({
      file: 'x.tsx',
      code: 'export const B = ({ s }) => <div style={s} />;',
      plugins: [inlineStyle],
    });
    expect(extracted.observations).toHaveLength(0);
    expect(extracted.diagnostics.some((d) => d.reason === 'dynamic-style-object')).toBe(true);
  });

  it('collapses inline and stylesheet spellings to the same property', () => {
    const inline = facts('export const B = () => <div style={{ backgroundColor: "#000" }} />;');
    if (inline[0]?.kind === 'css.declaration') {
      expect(inline[0].subject.property).toBe('background-color');
    }
  });

  it('treats a bare numeric on a dimensional property as px (React semantics)', () => {
    const result = facts('export const B = () => <div style={{ width: 10, marginTop: -4 }} />;');
    expect(result).toHaveLength(2);
    const byProp = new Map(
      result.flatMap((f) => (f.kind === 'css.declaration' ? [[f.subject.property, f]] : [])),
    );
    expect(byProp.get('width')?.value.type).toBe('length');
    expect(byProp.get('width')?.value.norm).toBe('10px');
    expect(byProp.get('margin-top')?.value.norm).toBe('-4px');
  });

  it('leaves unitless-number properties as plain numbers', () => {
    const result = facts(
      'export const B = () => <div style={{ zIndex: 10, lineHeight: 1.5, opacity: 1, flexGrow: 2 }} />;',
    );
    const byProp = new Map(
      result.flatMap((f) => (f.kind === 'css.declaration' ? [[f.subject.property, f]] : [])),
    );
    expect(byProp.get('z-index')?.value.type).toBe('number');
    expect(byProp.get('z-index')?.value.norm).toBe('10');
    expect(byProp.get('line-height')?.value.norm).toBe('1.5');
    expect(byProp.get('opacity')?.value.norm).toBe('1');
    expect(byProp.get('flex-grow')?.value.norm).toBe('2');
  });

  it('resolves an inline object-token member to a px length', () => {
    const result = facts(
      'const space = { sm: 4, md: 8 };\nexport const B = () => <div style={{ padding: space.md }} />;',
    );
    expect(result).toHaveLength(1);
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].certainty).toBe('literal');
      expect(result[0].value.norm).toBe('8px');
    }
  });
});

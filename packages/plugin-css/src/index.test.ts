import { assembleFacts, extractFile } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import cssDefault, { classifyCssValueType, cssPlugin } from './index.js';

function facts(code: string, file = 'src/Button.css') {
  return assembleFacts(extractFile({ file, code, plugins: [cssDefault] }));
}

describe('classifyCssValueType', () => {
  it('types colors, lengths, numbers, urls, shadows, keywords', () => {
    expect(classifyCssValueType('color', '#fff')).toBe('color');
    expect(classifyCssValueType('color', 'red')).toBe('color');
    expect(classifyCssValueType('background', 'rgb(0,0,0)')).toBe('color');
    expect(classifyCssValueType('padding', '4px')).toBe('length');
    expect(classifyCssValueType('z-index', '10')).toBe('number');
    expect(classifyCssValueType('background', 'url(a.png)')).toBe('url');
    expect(classifyCssValueType('box-shadow', '0 0 2px red')).toBe('shadow');
    expect(classifyCssValueType('display', 'flex')).toBe('keyword');
    expect(classifyCssValueType('margin', '4px 8px')).toBe('keyword');
  });
});

describe('cssPlugin', () => {
  it('emits one normalized css.declaration per declaration', () => {
    const result = facts('.btn { color: #FFF; padding: 4px; }');
    expect(result).toHaveLength(2);
    const [color, padding] = result;
    expect(color?.kind).toBe('css.declaration');
    if (color?.kind === 'css.declaration') {
      expect(color.subject.property).toBe('color');
      expect(color.subject.selector).toBe('.btn');
      expect(color.value.norm).toBe('#ffffff'); // normalized by core
      expect(color.certainty).toBe('literal');
    }
    if (padding?.kind === 'css.declaration') {
      expect(padding.value.norm).toBe('4px');
    }
  });

  it('captures the enclosing @media query', () => {
    const result = facts('@media (min-width: 600px) { .btn { color: red; } }');
    expect(result).toHaveLength(1);
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].subject.media).toBe('(min-width: 600px)');
      expect(result[0].subject.selector).toBe('.btn');
    }
  });

  it('supports a css-module source tag', () => {
    const plugin = cssPlugin({ source: 'css-module' });
    const result = assembleFacts(
      extractFile({ file: 'x.module.css', code: '.a { color: red; }', plugins: [plugin] }),
    );
    expect(result[0]?.source).toBe('css-module');
  });

  it('exposes a default instance', () => {
    expect(cssDefault.name).toBe('@factlas/plugin-css');
  });
});

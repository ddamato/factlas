import { describe, expect, it } from 'vitest';
import { normalizeColor } from './color.js';
import { formatNumber } from './format.js';
import { normalizeKeyword } from './keyword.js';
import { normalizeLength } from './length.js';
import { normalizeProperty } from './property.js';
import { normalizeValue } from './value.js';

describe('normalizeColor', () => {
  it('expands and lowercases hex', () => {
    expect(normalizeColor('#FFF')).toBe('#ffffff');
    expect(normalizeColor('#abc')).toBe('#aabbcc');
    expect(normalizeColor('#FFFFFF')).toBe('#ffffff');
  });

  it('converts rgb/hsl/named to hex', () => {
    expect(normalizeColor('rgb(255,0,0)')).toBe('#ff0000');
    expect(normalizeColor('red')).toBe('#ff0000');
    expect(normalizeColor('hsl(0, 100%, 50%)')).toBe('#ff0000');
  });

  it('uses 8-digit hex for partial alpha', () => {
    expect(normalizeColor('rgba(255,0,0,0.5)')).toBe('#ff000080');
  });

  it('collapses equivalent spellings to one value', () => {
    expect(normalizeColor('#FFF')).toBe(normalizeColor('#ffffff'));
    expect(normalizeColor('#F00')).toBe(normalizeColor('rgb(255, 0, 0)'));
  });

  it('returns null for unparseable input', () => {
    expect(normalizeColor('not-a-color')).toBeNull();
    expect(normalizeColor('')).toBeNull();
  });
});

describe('normalizeLength', () => {
  it('canonicalizes number + unit', () => {
    expect(normalizeLength('10.0PX')).toBe('10px');
    expect(normalizeLength('.5rem')).toBe('0.5rem');
    expect(normalizeLength('-2EM')).toBe('-2em');
    expect(normalizeLength('50%')).toBe('50%');
  });

  it('maps a bare 0 to 0px', () => {
    expect(normalizeLength('0')).toBe('0px');
    expect(normalizeLength('0px')).toBe('0px');
  });

  it('returns null for non-lengths', () => {
    expect(normalizeLength('auto')).toBeNull();
    expect(normalizeLength('10px 20px')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('strips redundant decimals and signs', () => {
    expect(formatNumber('10.0')).toBe('10');
    expect(formatNumber('+3')).toBe('3');
    expect(formatNumber('.5')).toBe('0.5');
    expect(formatNumber('-0')).toBe('0');
  });
});

describe('normalizeKeyword', () => {
  it('lowercases and trims', () => {
    expect(normalizeKeyword('  Bold ')).toBe('bold');
    expect(normalizeKeyword('CENTER')).toBe('center');
  });
});

describe('normalizeProperty', () => {
  it('camelCase → kebab', () => {
    expect(normalizeProperty('backgroundColor')).toBe('background-color');
    expect(normalizeProperty('color')).toBe('color');
  });

  it('handles vendor prefixes', () => {
    expect(normalizeProperty('WebkitTransform')).toBe('-webkit-transform');
    expect(normalizeProperty('MozAppearance')).toBe('-moz-appearance');
    expect(normalizeProperty('msFlex')).toBe('-ms-flex');
  });

  it('passes through kebab and custom properties', () => {
    expect(normalizeProperty('background-color')).toBe('background-color');
    expect(normalizeProperty('--myToken')).toBe('--myToken');
    expect(normalizeProperty('-webkit-box-shadow')).toBe('-webkit-box-shadow');
  });

  it('collapses inline and stylesheet spellings', () => {
    expect(normalizeProperty('backgroundColor')).toBe(normalizeProperty('background-color'));
  });
});

describe('normalizeValue dispatcher', () => {
  it('routes by type', () => {
    expect(normalizeValue('color', '#FFF')).toBe('#ffffff');
    expect(normalizeValue('length', '10.0px')).toBe('10px');
    expect(normalizeValue('number', '1.0')).toBe('1');
    expect(normalizeValue('keyword', 'BOLD')).toBe('bold');
    expect(normalizeValue('module', ' @acme/ui ')).toBe('@acme/ui');
    expect(normalizeValue('url', "url('a.png')")).toBe('url(a.png)');
    expect(normalizeValue('shadow', '0  0   2px   red')).toBe('0 0 2px red');
  });

  it('returns raw for opaque strings', () => {
    expect(normalizeValue('string', 'hello world')).toBe('hello world');
  });

  it('returns null for uncomparable and malformed values', () => {
    expect(normalizeValue('dynamic', 'x')).toBeNull();
    expect(normalizeValue('union', 'a|b')).toBeNull();
    expect(normalizeValue('number', 'auto')).toBeNull();
    expect(normalizeValue('url', 'noturl')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { canonicalStringify, sha256Hex } from './canonical.js';

describe('canonicalStringify', () => {
  it('sorts object keys independent of insertion order', () => {
    const a = canonicalStringify({ b: 1, a: 2, c: 3 });
    const b = canonicalStringify({ c: 3, a: 2, b: 1 });
    expect(a).toBe('{"a":2,"b":1,"c":3}');
    expect(a).toBe(b);
  });

  it('sorts nested object keys too', () => {
    expect(canonicalStringify({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it('preserves array order (order is meaningful)', () => {
    expect(canonicalStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('omits undefined-valued properties entirely', () => {
    expect(canonicalStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('serializes null explicitly', () => {
    expect(canonicalStringify({ a: null })).toBe('{"a":null}');
  });

  it('escapes strings via JSON rules', () => {
    expect(canonicalStringify('a"b\n')).toBe('"a\\"b\\n"');
  });

  it('throws on non-finite numbers', () => {
    expect(() => canonicalStringify(Number.NaN)).toThrow(/non-finite/);
    expect(() => canonicalStringify(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
  });

  it('throws on unsupported types', () => {
    expect(() => canonicalStringify(10n)).toThrow(/bigint/);
    expect(() => canonicalStringify(() => {})).toThrow(/function/);
  });
});

describe('sha256Hex', () => {
  it('matches a known vector for the empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is stable for strings and equivalent byte buffers', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex(new TextEncoder().encode('abc')));
  });
});

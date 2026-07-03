import { describe, expect, it } from 'vitest';
import { classifyCertainty } from './classify.js';
import type { RawObservationValue } from './plugin/types.js';

const v = (over: Partial<RawObservationValue>): RawObservationValue => ({
  raw: 'x',
  type: 'keyword',
  ...over,
});

describe('classifyCertainty', () => {
  it('treats a missing value (jsx.element) as literal', () => {
    expect(classifyCertainty(undefined)).toBe('literal');
  });

  it('classifies a detected dynamic placeholder as dynamic', () => {
    expect(classifyCertainty(v({ dynamic: true }))).toBe('dynamic');
    expect(classifyCertainty(v({ type: 'dynamic' }))).toBe('dynamic');
  });

  it('classifies a union type as static-union', () => {
    expect(classifyCertainty(v({ type: 'union' }))).toBe('static-union');
  });

  it('honors an explicit certainty hint', () => {
    expect(classifyCertainty(v({ certaintyHint: 'static-union' }))).toBe('static-union');
    expect(classifyCertainty(v({ certaintyHint: 'unknown' }))).toBe('unknown');
  });

  it('defaults to literal', () => {
    expect(classifyCertainty(v({}))).toBe('literal');
  });

  it('prioritizes dynamic over a conflicting hint', () => {
    expect(classifyCertainty(v({ dynamic: true, certaintyHint: 'literal' }))).toBe('dynamic');
  });
});

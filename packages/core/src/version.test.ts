import { describe, expect, it } from 'vitest';
import { FACT_SCHEMA_VERSION, NORMALIZER_VERSION } from './index.js';

describe('version constants', () => {
  it('exposes semver-shaped schema and normalizer versions', () => {
    expect(FACT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(NORMALIZER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

import { describe, expect, it } from 'vitest';
import { TOOL_PACKAGES, toolVersions } from './tools.js';

describe('toolVersions', () => {
  it('resolves factlas parser/normalizer dependency versions', () => {
    const versions = toolVersions();
    // Core's direct deps are always installed in this workspace.
    expect(versions['@babel/parser']).toMatch(/^\d+\.\d+\.\d+/);
    expect(versions.culori).toMatch(/^\d+\.\d+\.\d+/);
    expect(versions.postcss).toMatch(/^\d+\.\d+\.\d+/);
    expect(versions['postcss-value-parser']).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('only ever reports known tool packages', () => {
    const known = new Set<string>(TOOL_PACKAGES);
    for (const name of Object.keys(toolVersions())) expect(known.has(name)).toBe(true);
  });

  it('is deterministic across calls', () => {
    expect(toolVersions()).toEqual(toolVersions());
  });
});

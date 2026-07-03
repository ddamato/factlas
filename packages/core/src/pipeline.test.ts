import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Rule } from 'postcss';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalStringify } from './canonical.js';
import { postcssLoc } from './loc.js';
import { extractRepo } from './pipeline.js';
import type { DesignFactsPlugin } from './plugin/types.js';

/** Minimal CSS plugin for exercising the repo pipeline. */
const cssPlugin: DesignFactsPlugin = {
  name: '@test/css',
  version: '1.0.0',
  analyzeCss(root, ctx) {
    root.walkDecls((decl) => {
      const parent = decl.parent;
      const selector = parent && parent.type === 'rule' ? (parent as Rule).selector : null;
      ctx.emit({
        kind: 'css.declaration',
        loc: postcssLoc(decl),
        source: 'plain-css',
        subject: { property: decl.prop, selector, media: null, owner_component: null },
        value: { raw: decl.value, type: 'color' },
      });
    });
  },
};

let root: string;

async function write(rel: string, contents: string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factlas-pipeline-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('extractRepo', () => {
  it('discovers, extracts, normalizes, and sorts facts', async () => {
    await write('a.css', '.a { color: #FFF; }');
    await write('b.css', '.b { color: rgb(0,0,0); }');

    const { header, facts, diagnostics } = await extractRepo({ root, plugins: [cssPlugin] });

    expect(header.plugin_versions).toEqual({ '@test/css': '1.0.0' });
    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.file)).toEqual(['a.css', 'b.css']); // sorted
    expect(facts.map((f) => ('value' in f ? f.value.norm : null))).toEqual(['#ffffff', '#000000']);
    expect(diagnostics).toHaveLength(0);
  });

  it('is deterministic across runs', async () => {
    await write('a.css', '.a { color: #FFF; }');
    const first = await extractRepo({ root, plugins: [cssPlugin] });
    const second = await extractRepo({ root, plugins: [cssPlugin] });
    expect(canonicalStringify(second)).toBe(canonicalStringify(first));
  });
});

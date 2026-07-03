import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Rule } from 'postcss';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDiskCache, fileCacheKey, runSignature } from './cache.js';
import { canonicalStringify } from './canonical.js';
import type { SnapshotHeader } from './discover.js';
import { postcssLoc } from './loc.js';
import { extractRepo } from './pipeline.js';
import type { DesignFactsPlugin } from './plugin/types.js';

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
        subject: {
          property: decl.prop,
          selector,
          media: null,
          owner_component: null,
          element_id: null,
        },
        value: { raw: decl.value, type: 'color' },
      });
    });
  },
};

let root: string;

async function write(rel: string, contents: string): Promise<void> {
  await writeFile(path.join(root, rel), contents, 'utf8');
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factlas-cache-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const header = (over: Partial<SnapshotHeader> = {}): SnapshotHeader => ({
  schema_v: '0.2.0',
  normalizer_v: '0.2.0',
  tool_versions: {},
  plugin_versions: {},
  config_hashes: {},
  file_count: 0,
  files_digest: 'd',
  cache_key: 'k',
  ...over,
});

describe('cache keys', () => {
  it('signature ignores file-set fields but tracks determinism inputs', () => {
    const base = runSignature(header());
    // File-count/digest/cache_key must not affect the signature.
    expect(runSignature(header({ file_count: 9, files_digest: 'x', cache_key: 'y' }))).toBe(base);
    // Any determinism input must change it.
    expect(runSignature(header({ normalizer_v: '0.3.0' }))).not.toBe(base);
    expect(runSignature(header({ plugin_versions: { p: '2.0.0' } }))).not.toBe(base);
    expect(runSignature(header({ tool_versions: { t: '1.0.0' } }))).not.toBe(base);
    expect(runSignature(header({ config_hashes: { 'tw.js': 'abc' } }))).not.toBe(base);
  });

  it('file key depends on signature, path, and content hash', () => {
    const k = fileCacheKey('sig', 'a.css', 'h1');
    expect(fileCacheKey('sig', 'a.css', 'h1')).toBe(k);
    expect(fileCacheKey('sig2', 'a.css', 'h1')).not.toBe(k);
    expect(fileCacheKey('sig', 'b.css', 'h1')).not.toBe(k);
    expect(fileCacheKey('sig', 'a.css', 'h2')).not.toBe(k);
  });
});

describe('extractRepo with a cache', () => {
  it('produces byte-identical output with and without the cache', async () => {
    await write('a.css', '.a { color: #FFF; }');
    await write('b.css', '.b { color: rgb(0,0,0); }');

    const uncached = await extractRepo({ root, plugins: [cssPlugin] });
    const cache = await createDiskCache(path.join(root, '.factlas/cache.json'));
    const cached = await extractRepo({ root, plugins: [cssPlugin], cache });

    expect(canonicalStringify(cached.facts)).toBe(canonicalStringify(uncached.facts));
  });

  it('misses on the first run and hits an unchanged file on the second', async () => {
    await write('a.css', '.a { color: #FFF; }');
    const file = path.join(root, '.factlas/cache.json');

    const first = await createDiskCache(file);
    const r1 = await extractRepo({ root, plugins: [cssPlugin], cache: first });
    expect(first.hits).toBe(0);
    expect(first.misses).toBe(1);
    await first.save();

    const second = await createDiskCache(file);
    const r2 = await extractRepo({ root, plugins: [cssPlugin], cache: second });
    expect(second.hits).toBe(1);
    expect(second.misses).toBe(0);
    // A cache hit must return exactly the same facts as the fresh extraction.
    expect(canonicalStringify(r2.facts)).toBe(canonicalStringify(r1.facts));
  });

  it('misses again when a file changes', async () => {
    const file = path.join(root, '.factlas/cache.json');
    await write('a.css', '.a { color: #FFF; }');
    const first = await createDiskCache(file);
    await extractRepo({ root, plugins: [cssPlugin], cache: first });
    await first.save();

    await write('a.css', '.a { color: #000; }'); // content changed → new hash
    const second = await createDiskCache(file);
    await extractRepo({ root, plugins: [cssPlugin], cache: second });
    expect(second.hits).toBe(0);
    expect(second.misses).toBe(1);
  });

  it('invalidates every entry when a plugin version changes', async () => {
    const file = path.join(root, '.factlas/cache.json');
    await write('a.css', '.a { color: #FFF; }');
    const first = await createDiskCache(file);
    await extractRepo({ root, plugins: [cssPlugin], cache: first });
    await first.save();

    const bumped = { ...cssPlugin, version: '2.0.0' };
    const second = await createDiskCache(file);
    await extractRepo({ root, plugins: [bumped], cache: second });
    expect(second.hits).toBe(0);
  });

  it('persists a canonical cache file and reloads it', async () => {
    const file = path.join(root, '.factlas/cache.json');
    await write('a.css', '.a { color: #FFF; }');
    const cache = await createDiskCache(file);
    await extractRepo({ root, plugins: [cssPlugin], cache });
    await cache.save();

    const onDisk = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk.format).toBe(1);
    expect(Object.keys(onDisk.entries)).toHaveLength(1);
  });

  it('treats a corrupt cache file as empty', async () => {
    const file = path.join(root, '.factlas/cache.json');
    await write('a.css', '.a { color: #FFF; }');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'not json{', 'utf8');
    const cache = await createDiskCache(file);
    const r = await extractRepo({ root, plugins: [cssPlugin], cache });
    expect(cache.misses).toBe(1);
    expect(r.facts).toHaveLength(1);
  });
});

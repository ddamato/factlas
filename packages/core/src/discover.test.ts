import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discover } from './discover.js';

let root: string;

async function write(rel: string, contents: string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factlas-discover-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('discover', () => {
  it('returns repo-relative POSIX paths, sorted, with byte hashes', async () => {
    await write('src/b.css', '.b{color:#fff}');
    await write('src/a.tsx', 'export const A = () => null;');
    await write('src/nested/c.ts', 'export const c = 1;');
    await write('README.md', 'ignored: wrong extension');
    await write('node_modules/dep/index.ts', 'export const dep = 1;');

    const { files } = await discover({ root });

    expect(files.map((f) => f.path)).toEqual(['src/a.tsx', 'src/b.css', 'src/nested/c.ts']);
    for (const f of files) {
      expect(f.path).not.toContain('\\'); // POSIX separators only
      expect(f.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(f.bytes).toBeGreaterThan(0);
    }
  });

  it('produces a stable cache_key across identical runs', async () => {
    await write('src/a.tsx', 'export const A = () => null;');
    const first = await discover({ root });
    const second = await discover({ root });
    expect(second.header.cache_key).toBe(first.header.cache_key);
    expect(second.header.files_digest).toBe(first.header.files_digest);
  });

  it('changes cache_key when file contents change', async () => {
    await write('src/a.tsx', 'export const A = () => null;');
    const before = await discover({ root });
    await write('src/a.tsx', 'export const A = () => <div />;');
    const after = await discover({ root });
    expect(after.header.cache_key).not.toBe(before.header.cache_key);
  });

  it('folds config-file hashes and tool/plugin versions into the cache_key', async () => {
    await write('src/a.tsx', 'export const A = () => null;');
    await write('tailwind.config.js', 'module.exports = { theme: {} };');

    const withoutConfig = await discover({ root });
    const withConfig = await discover({ root, configFiles: ['tailwind.config.js'] });
    expect(withConfig.header.cache_key).not.toBe(withoutConfig.header.cache_key);
    expect(withConfig.header.config_hashes['tailwind.config.js']).toMatch(/^[0-9a-f]{64}$/);

    const withVersions = await discover({
      root,
      pluginVersions: { '@factlas/plugin-css': '0.1.0' },
    });
    expect(withVersions.header.cache_key).not.toBe(withoutConfig.header.cache_key);
  });

  it('changes cache_key when a config file changes', async () => {
    await write('src/a.tsx', 'export const A = () => null;');
    await write('tailwind.config.js', 'module.exports = { theme: {} };');
    const before = await discover({ root, configFiles: ['tailwind.config.js'] });
    await write('tailwind.config.js', 'module.exports = { theme: { colors: {} } };');
    const after = await discover({ root, configFiles: ['tailwind.config.js'] });
    expect(after.header.cache_key).not.toBe(before.header.cache_key);
  });
});

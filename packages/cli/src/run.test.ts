import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIO, run, VERSION } from './run.js';

let root: string;

function makeIo(): CliIO & { stdout: string; stderr: string } {
  const state = {
    cwd: '',
    stdout: '',
    stderr: '',
    out(text: string) {
      this.stdout += text;
    },
    err(text: string) {
      this.stderr += text;
    },
    writeFile(file: string, data: string) {
      return writeFile(file, data, 'utf8');
    },
  };
  return state;
}

async function write(rel: string, contents: string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'factlas-cli-'));
  await write('Button.css', '.btn { color: #FFF; }');
  await write('Badge.tsx', 'export const B = () => <div style={{ color: "red" }} />;');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('run: extract', () => {
  it('emits a { snapshot_header, facts } stream to stdout', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run(['extract'], io);
    expect(code).toBe(0);

    const output = JSON.parse(io.stdout);
    expect(output).toHaveProperty('snapshot_header');
    expect(Array.isArray(output.facts)).toBe(true);
    // css #FFF and inline color:red both extracted and normalized.
    const norms = output.facts.map((f: { value?: { norm: string } }) => f.value?.norm);
    expect(norms).toContain('#ffffff');
    expect(norms).toContain('#ff0000');
    // summary goes to stderr, keeping stdout pure JSON.
    expect(io.stderr).toMatch(/facts from 2 files/);
  });

  it('writes to a file with --out', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run(['extract', '.', '--out', 'facts.json'], io);
    expect(code).toBe(0);
    expect(io.stdout).toBe('');
    const written = await readFile(path.join(root, 'facts.json'), 'utf8');
    expect(JSON.parse(written)).toHaveProperty('facts');
  });

  it('is deterministic: two runs produce identical output', async () => {
    const a = makeIo();
    a.cwd = root;
    const b = makeIo();
    b.cwd = root;
    await run(['extract'], a);
    await run(['extract'], b);
    expect(b.stdout).toBe(a.stdout);
  });

  it('errors on a missing directory', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run(['extract', 'does-not-exist'], io);
    expect(code).toBe(1);
    expect(io.stderr).toMatch(/no such directory/);
  });
});

describe('run: meta', () => {
  it('prints version', async () => {
    const io = makeIo();
    io.cwd = root;
    expect(await run(['--version'], io)).toBe(0);
    expect(io.stdout.trim()).toBe(VERSION);
  });

  it('prints help with no command', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run([], io);
    expect(code).toBe(1);
    expect(io.stdout).toMatch(/Usage:/);
  });

  it('rejects an unknown command', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run(['evaluate'], io);
    expect(code).toBe(2);
    expect(io.stderr).toMatch(/unknown command/);
  });

  it('rejects unknown options', async () => {
    const io = makeIo();
    io.cwd = root;
    const code = await run(['extract', '--bogus'], io);
    expect(code).toBe(2);
  });
});

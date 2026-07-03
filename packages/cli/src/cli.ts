#!/usr/bin/env node
/**
 * The `factlas` executable. Thin wrapper: wire real stdio/fs into `run`.
 */

import { writeFile } from 'node:fs/promises';
import { run } from './run.js';

run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  writeFile: (file, data) => writeFile(file, data, 'utf8'),
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`factlas: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });

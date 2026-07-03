/**
 * `factlas-eval <facts.json>` — evaluate a factlas fact stream against the
 * bundled policies and gate on it. Prints the SARIF log to stdout (pipe it to a
 * file or to GitHub code scanning), a summary to stderr, and exits non-zero when
 * any `error`-level violation is found.
 *
 * Usage:
 *   factlas extract ./src --out facts.json
 *   factlas-eval facts.json > results.sarif
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { Fact } from '@factlas/core';
import { evaluate } from './evaluate.js';
import { formatReport } from './report.js';
import { toSarif } from './sarif.js';

const USAGE = `factlas-eval — evaluate a factlas fact stream (demo)

Usage:
  factlas-eval <facts.json> [--sarif <file>]

Reads a fact stream (the { snapshot_header, facts } output of \`factlas extract\`,
or a bare facts array), runs the bundled policy set, and emits SARIF 2.1.0.
Exits non-zero if any error-level violation is found.

Options:
  --sarif <file>   Write SARIF to <file> instead of stdout
  -h, --help       Show this help
`;

/** Read a facts file that is either { facts: [...] } or a bare array. */
function factsOf(parsed: unknown): Fact[] {
  if (Array.isArray(parsed)) return parsed as Fact[];
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { facts?: unknown }).facts)
  ) {
    return (parsed as { facts: Fact[] }).facts;
  }
  throw new Error('expected a JSON array of facts or an object with a "facts" array');
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { sarif: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }

  const factsPath = positionals[0] as string;
  let facts: Fact[];
  try {
    facts = factsOf(JSON.parse(await readFile(factsPath, 'utf8')));
  } catch (err) {
    process.stderr.write(`factlas-eval: cannot read ${factsPath}: ${message(err)}\n`);
    return 2;
  }

  const result = await evaluate(facts);
  const sarif = `${JSON.stringify(toSarif(result), null, 2)}\n`;

  if (values.sarif) await writeFile(values.sarif, sarif, 'utf8');
  else process.stdout.write(sarif);

  process.stderr.write(`${formatReport(result)}\n`);
  return result.ok ? 0 : 1;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`factlas-eval: ${message(err)}\n`);
    process.exit(2);
  },
);

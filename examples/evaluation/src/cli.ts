/**
 * `factlas-eval <facts.json>` — load a factlas fact stream into a SQLite DB,
 * evaluate it against the bundled policies, and gate on it. Prints the SARIF log
 * to stdout (pipe it to a file or GitHub code scanning), a summary to stderr, and
 * exits non-zero when any `error`-level violation is found.
 *
 * Usage:
 *   factlas extract ./src --out facts.json
 *   factlas-eval facts.json --db facts.db > results.sarif
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { Fact } from '@factlas/core';
import { buildDatabase } from './database.js';
import { runPolicies } from './evaluate.js';
import { loadPolicies } from './policy.js';
import { formatReport } from './report.js';
import { toSarif } from './sarif.js';

const USAGE = `factlas-eval — evaluate a factlas fact stream (demo)

Usage:
  factlas-eval <facts.json> [--db <file>] [--sarif <file>]

Loads a fact stream (the { snapshot_header, facts } output of \`factlas extract\`,
or a bare facts array) into a SQLite database, runs the bundled policy set, and
emits SARIF 2.1.0. Exits non-zero if any error-level violation is found.

Options:
  --db <file>      Persist the fact database to <file> (default: in memory)
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
    options: {
      db: { type: 'string' },
      sarif: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
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

  const db = buildDatabase(facts, values.db ? { file: values.db } : {});
  const result = runPolicies(db, await loadPolicies());
  db.close();
  if (values.db) process.stderr.write(`factlas-eval: fact database written to ${values.db}\n`);

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

/**
 * The extraction router (ADR §2.2, Phase 2 step 6).
 *
 * `extractFile` routes a file by extension: CSS files parse to a PostCSS root and
 * go to `analyzeCss`; TS/TSX files parse to a Babel AST and go to
 * `analyzeProgram`. CSS carriers embedded in TSX (styled templates, inline
 * objects, className strings) are lifted by the plugins that understand them and
 * routed back to the CSS path via `PluginContext.parseCss`, so all CSS converges
 * on one parser.
 *
 * Robustness is a hard requirement: a parse failure or a throwing plugin becomes
 * a diagnostic, never a crash and never a silently dropped file.
 */

import valueParser from 'postcss-value-parser';
import { parseModule, traverse } from '../parse/babel.js';
import { parseStylesheet } from '../parse/css.js';
import { resolveExpression } from '../plugin/resolve.js';
import {
  type DesignFactsPlugin,
  type Diagnostic,
  type EmittedObservation,
  type Observation,
  type PluginContext,
  producerId,
} from '../plugin/types.js';

/** Re-export so plugin authors traverse without depending on Babel directly. */
export { traverse };

/** Result of extracting a single file. */
export interface ExtractFileResult {
  file: string;
  observations: EmittedObservation[];
  diagnostics: Diagnostic[];
}

export interface ExtractFileOptions {
  /** Repo-relative POSIX path. */
  file: string;
  /** File contents. */
  code: string;
  /** Registered plugins to dispatch to. */
  plugins: readonly DesignFactsPlugin[];
}

type Ext = 'css' | 'ts' | 'tsx' | 'other';

function extOf(file: string): Ext {
  const lower = file.toLowerCase();
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.ts')) return 'ts';
  return 'other';
}

/** Mutable collection sink shared by every plugin context for a file. */
interface Sink {
  observations: EmittedObservation[];
  diagnostics: Diagnostic[];
}

/** Build the injected context for one plugin invocation. */
function makeContext(file: string, code: string, producer: string, sink: Sink): PluginContext {
  return {
    file,
    code,
    tokenize: (value) => valueParser(value),
    resolve: (node, scope) => resolveExpression(node, scope),
    parseCss: (css) => parseStylesheet(css, file).root,
    emit: (observation: Observation) => {
      sink.observations.push({ producer, observation });
    },
    diagnostic: (d) => {
      sink.diagnostics.push({ file, producer, ...d });
    },
  };
}

/**
 * Extract raw observations from a single file. Deterministic given identical
 * inputs and plugin order; the caller sorts final facts globally.
 */
export function extractFile(options: ExtractFileOptions): ExtractFileResult {
  const { file, code, plugins } = options;
  const sink: Sink = { observations: [], diagnostics: [] };
  const ext = extOf(file);

  if (ext === 'other') {
    return { file, observations: sink.observations, diagnostics: sink.diagnostics };
  }

  if (ext === 'css') {
    dispatchCss(file, code, plugins, sink);
  } else {
    dispatchProgram(file, code, plugins, sink);
  }

  return { file, observations: sink.observations, diagnostics: sink.diagnostics };
}

function dispatchCss(
  file: string,
  code: string,
  plugins: readonly DesignFactsPlugin[],
  sink: Sink,
): void {
  const cssPlugins = plugins.filter((p) => p.analyzeCss);
  if (cssPlugins.length === 0) return;

  let root: ReturnType<typeof parseStylesheet>['root'];
  try {
    root = parseStylesheet(code, file).root;
  } catch (err) {
    sink.diagnostics.push({
      file,
      producer: '@factlas/core',
      reason: 'parse-error',
      message: errorMessage(err),
    });
    return;
  }

  for (const plugin of cssPlugins) {
    const producer = producerId(plugin);
    const ctx = makeContext(file, code, producer, sink);
    runGuarded(() => plugin.analyzeCss?.(root, ctx), file, producer, sink);
  }
}

function dispatchProgram(
  file: string,
  code: string,
  plugins: readonly DesignFactsPlugin[],
  sink: Sink,
): void {
  const programPlugins = plugins.filter((p) => p.analyzeProgram);
  if (programPlugins.length === 0) return;

  let parsed: ReturnType<typeof parseModule>;
  try {
    parsed = parseModule(code, file);
  } catch (err) {
    sink.diagnostics.push({
      file,
      producer: '@factlas/core',
      reason: 'parse-error',
      message: errorMessage(err),
    });
    return;
  }

  for (const plugin of programPlugins) {
    const producer = producerId(plugin);
    const ctx = makeContext(file, code, producer, sink);
    runGuarded(() => plugin.analyzeProgram?.(parsed.ast, ctx), file, producer, sink);
  }
}

/** Run a plugin step; a thrown error becomes a diagnostic, never a crash. */
function runGuarded(fn: () => void, file: string, producer: string, sink: Sink): void {
  try {
    fn();
  } catch (err) {
    sink.diagnostics.push({
      file,
      producer,
      reason: 'plugin-error',
      message: errorMessage(err),
    });
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

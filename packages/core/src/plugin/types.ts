/**
 * The plugin contract (ADR §2.2 / §2.6, Phase 2 step 5).
 *
 * Plugins own technology knowledge; core owns normalization and identity. So a
 * plugin's job is to emit **raw observations** — it classifies a value's `type`
 * and may hint at `certainty`, but it never computes `value.norm`, the final
 * `certainty`, or the `fact_id`. Those are core's (Phase 3+). This keeps the
 * novel, versioned logic from forking across plugins.
 */

import type { Scope } from '@babel/traverse';
import type { File, Node } from '@babel/types';
import type { Root } from 'postcss';
import type {
  Certainty,
  CssClassSubject,
  CssDeclarationSubject,
  FactKind,
  FactSource,
  ImportSubject,
  JsxAttributeSubject,
  JsxElementSubject,
  JsxPropSubject,
  Loc,
  ValueType,
} from '../fact.js';
import type { ResolveResult } from './resolve.js';

/** A value as first seen by a plugin, before core normalizes it (Phase 3). */
export interface RawObservationValue {
  /** Verbatim source text. */
  raw: string;
  /** The plugin's classification of the value's type. */
  type: ValueType;
  /**
   * The plugin's certainty hint. Core makes the final call, but a plugin that
   * already knows a value is dynamic (contains an unresolved placeholder) should
   * say so here and set {@link RawObservationValue.dynamic}.
   */
  certaintyHint?: Certainty;
  /** True when the plugin detected an unresolved dynamic placeholder. */
  dynamic?: boolean;
}

interface ObservationBase {
  loc: Loc;
  source: FactSource;
  /** Reason string when the observation is dynamic/unknown (never dropped). */
  diagnostic?: string;
}

/**
 * A raw observation emitted by a plugin. Mirrors the fact catalog minus the
 * fields core derives (`fact_id`, `schema_v`, final `value.norm`/`certainty`).
 */
export type Observation =
  | (ObservationBase & { kind: 'jsx.element'; subject: JsxElementSubject })
  | (ObservationBase & { kind: 'jsx.prop'; subject: JsxPropSubject; value: RawObservationValue })
  | (ObservationBase & {
      kind: 'jsx.attribute';
      subject: JsxAttributeSubject;
      value: RawObservationValue;
    })
  | (ObservationBase & { kind: 'import'; subject: ImportSubject; value: RawObservationValue })
  | (ObservationBase & {
      kind: 'css.declaration';
      subject: CssDeclarationSubject;
      value: RawObservationValue;
    })
  | (ObservationBase & { kind: 'css.class'; subject: CssClassSubject; value: RawObservationValue });

/** An observation tagged with the plugin that produced it. */
export interface EmittedObservation {
  /** Producer id, `name@version`. */
  producer: string;
  observation: Observation;
}

/** A non-fatal diagnostic (unresolved value, plugin error, parse failure). */
export interface Diagnostic {
  file: string;
  producer: string;
  /** Machine-readable reason code, e.g. `unresolved-identifier`, `parse-error`. */
  reason: string;
  message?: string;
  loc?: Loc;
  kind?: FactKind;
}

/**
 * Utilities core injects into every plugin invocation. A plugin should reach for
 * these rather than reimplementing tokenization, resolution, or CSS parsing.
 */
export interface PluginContext {
  /** Repo-relative POSIX path of the file being analyzed. */
  readonly file: string;
  /** The full source text of the file, for slicing verbatim `raw` values. */
  readonly code: string;
  /** Tokenize a CSS value string (`postcss-value-parser`). */
  tokenize(value: string): import('postcss-value-parser').ParsedValue;
  /** Bounded static resolution of an expression (one hop, literals only). */
  resolve(node: Node, scope?: Scope): ResolveResult;
  /** Re-enter the CSS path for a lifted carrier (styled template, etc.). */
  parseCss(css: string): Root;
  /** Emit a raw observation. */
  emit(observation: Observation): void;
  /** Record a non-fatal diagnostic. */
  diagnostic(diagnostic: Omit<Diagnostic, 'file' | 'producer'>): void;
}

/**
 * A design-facts plugin. Implement `analyzeCss` and/or `analyzeProgram`. Both are
 * optional; the extractor calls whichever apply to the current file. Plugins are
 * synchronous and must not perform I/O or execute repository code.
 */
export interface DesignFactsPlugin {
  /** Stable plugin name, e.g. `@factlas/plugin-css`. */
  readonly name: string;
  /** Plugin version; folded into the snapshot header (a bump invalidates caches). */
  readonly version: string;
  /** Analyze a parsed stylesheet (plain CSS, CSS Module, or a lifted carrier). */
  analyzeCss?(root: Root, ctx: PluginContext): void;
  /** Analyze a parsed TS/TSX module AST. */
  analyzeProgram?(ast: File, ctx: PluginContext): void;
}

/** The producer id for a plugin, `name@version`. */
export function producerId(plugin: DesignFactsPlugin): string {
  return `${plugin.name}@${plugin.version}`;
}

/** Plugin versions map for the snapshot header, keyed by plugin name (sorted). */
export function pluginVersions(plugins: readonly DesignFactsPlugin[]): Record<string, string> {
  const entries = plugins.map((p) => [p.name, p.version] as const);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(entries);
}

/**
 * The Fact shape — the contract everything binds to (ADR §2.3).
 *
 * Every fact has a common {@link FactEnvelope} plus a kind-specific `subject`
 * and (usually) a normalized {@link FactValue}. The discriminated union
 * {@link Fact} is the single type consumers import. The runtime JSON Schema in
 * `schema/fact.schema.json` mirrors these types and is gated by
 * {@link FACT_SCHEMA_VERSION}.
 */

import type { FACT_SCHEMA_VERSION } from './version.js';

/** The v1 fact catalog (ADR §2.3). `kind` is the join key to policies. */
export type FactKind =
  | 'jsx.element'
  | 'jsx.prop'
  | 'jsx.attribute'
  | 'import'
  | 'css.declaration'
  | 'css.class';

/** Where a fact was observed / which extractor path produced it. */
export type FactSource =
  | 'plain-css'
  | 'css-module'
  | 'inline'
  | 'css-in-js'
  | 'tailwind'
  | 'babel-jsx';

/** How confidently the value is known (ADR §2.5). Drives policy routing. */
export type Certainty = 'literal' | 'static-union' | 'dynamic' | 'unknown';

/** The normalized value's type tag. `norm` is `null` for `dynamic`/`unknown`. */
export type ValueType =
  | 'color'
  | 'length'
  | 'number'
  | 'keyword'
  | 'string'
  | 'url'
  | 'shadow'
  | 'module'
  | 'dynamic'
  | 'union';

/** How an import binding was introduced. */
export type ImportKind = 'default' | 'named' | 'namespace' | 'side-effect';

/** Source location, 1-based line, 0-based column (Babel/PostCSS convention). */
export interface Loc {
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

/**
 * A value carried by a fact. **Check on `norm`; display `raw`.**
 * `norm` is `null` exactly when `type` is `dynamic` or `unknown`-derived.
 */
export interface FactValue {
  /** Verbatim source text, for display and diagnostics. */
  raw: string;
  /** Canonical, normalizer-versioned form used for comparison; `null` if dynamic. */
  norm: string | null;
  type: ValueType;
}

/** Fields present on every fact, regardless of kind (ADR §2.3). */
export interface FactEnvelope {
  /** sha256 of canonical `{kind, file, loc, subject, value.norm}`. */
  fact_id: string;
  kind: FactKind;
  /** {@link FACT_SCHEMA_VERSION} at emit time. */
  schema_v: typeof FACT_SCHEMA_VERSION;
  /** Repo-relative, POSIX-normalized path. */
  file: string;
  loc: Loc;
  source: FactSource;
  /** Emitting plugin name + version, e.g. `@factlas/plugin-css@0.1.0`. */
  producer_v: string;
  certainty: Certainty;
  /**
   * Why a value is `dynamic`/`unknown`. Required whenever a value could not be
   * fully resolved, so nothing is ever dropped silently (ADR §2.4 rule 6).
   */
  diagnostic?: string;
}

// --- Subjects (kind-specific) ------------------------------------------------

export interface JsxElementSubject {
  name: string;
  /** Package/module the component was imported from, or `null` for DOM/intrinsic. */
  imported_from: string | null;
  is_dom: boolean;
}

export interface JsxPropSubject {
  component: string;
  prop: string;
  /** FK to the owning `jsx.element` fact's `fact_id`. */
  element_id: string;
}

export interface JsxAttributeSubject {
  owner: string;
  attribute: string;
  /** FK to the owning `jsx.element` fact's `fact_id`. */
  element_id: string;
}

export interface ImportSubject {
  specifier: string;
  local: string;
  import_kind: ImportKind;
}

export interface CssDeclarationSubject {
  property: string;
  selector: string | null;
  media: string | null;
  owner_component: string | null;
}

export interface CssClassSubject {
  token: string;
  utility: string | null;
  is_arbitrary: boolean;
  /** FK to the owning `jsx.element` fact's `fact_id`, when known. */
  element_id: string | null;
}

// --- Facts (discriminated union on `kind`) -----------------------------------

/** `jsx.element` carries no value. */
export interface JsxElementFact extends FactEnvelope {
  kind: 'jsx.element';
  subject: JsxElementSubject;
}

export interface JsxPropFact extends FactEnvelope {
  kind: 'jsx.prop';
  subject: JsxPropSubject;
  value: FactValue;
}

export interface JsxAttributeFact extends FactEnvelope {
  kind: 'jsx.attribute';
  subject: JsxAttributeSubject;
  value: FactValue;
}

export interface ImportFact extends FactEnvelope {
  kind: 'import';
  subject: ImportSubject;
  /** The imported module specifier as a `module`-typed value. */
  value: FactValue;
}

export interface CssDeclarationFact extends FactEnvelope {
  kind: 'css.declaration';
  subject: CssDeclarationSubject;
  value: FactValue;
}

export interface CssClassFact extends FactEnvelope {
  kind: 'css.class';
  subject: CssClassSubject;
  value: FactValue;
}

/** The single fact type consumers bind to. */
export type Fact =
  | JsxElementFact
  | JsxPropFact
  | JsxAttributeFact
  | ImportFact
  | CssDeclarationFact
  | CssClassFact;

/** Map from `kind` to its subject type, for generic helpers. */
export interface SubjectByKind {
  'jsx.element': JsxElementSubject;
  'jsx.prop': JsxPropSubject;
  'jsx.attribute': JsxAttributeSubject;
  import: ImportSubject;
  'css.declaration': CssDeclarationSubject;
  'css.class': CssClassSubject;
}

/** All fact kinds, as a runtime array (sorted, stable) for iteration/validation. */
export const FACT_KINDS = [
  'css.class',
  'css.declaration',
  'import',
  'jsx.attribute',
  'jsx.element',
  'jsx.prop',
] as const satisfies readonly FactKind[];

/**
 * @factlas/core — the deterministic fact layer.
 *
 * Public entry point. Phase 1 exposes the Fact contract and the determinism
 * spine (canonical serialization, content-addressed `fact_id`, discovery +
 * snapshot header). Parsing, the plugin host, and normalizers land in later
 * phases (see IMPLEMENTATION_PLAN.md).
 */

export { FACT_SCHEMA_VERSION, NORMALIZER_VERSION } from './version.js';

export type {
  Certainty,
  CssClassFact,
  CssClassSubject,
  CssDeclarationFact,
  CssDeclarationSubject,
  Fact,
  FactEnvelope,
  FactKind,
  FactSource,
  FactValue,
  ImportFact,
  ImportKind,
  ImportSubject,
  JsxAttributeFact,
  JsxAttributeSubject,
  JsxElementFact,
  JsxElementSubject,
  JsxPropFact,
  JsxPropSubject,
  Loc,
  SubjectByKind,
  ValueType,
} from './fact.js';
export { FACT_KINDS } from './fact.js';

export { canonicalStringify, sha256Hex } from './canonical.js';

export { computeFactId, factify } from './factify.js';
export type { FactDraft, FactIdInput } from './factify.js';

export { buildHeader, DEFAULT_EXCLUDE, DEFAULT_INCLUDE, discover } from './discover.js';
export type {
  DiscoveredFile,
  DiscoverOptions,
  DiscoverResult,
  SnapshotHeader,
} from './discover.js';

// --- Phase 2: parsing, plugin host, extraction -------------------------------

export { babelLoc, postcssLoc } from './loc.js';

export { BABEL_PLUGINS, parseModule, traverse } from './parse/babel.js';
export type { ParsedModule } from './parse/babel.js';
export { parseStylesheet } from './parse/css.js';
export type { ParsedStylesheet } from './parse/css.js';

export { DEFAULT_HOPS, resolveExpression } from './plugin/resolve.js';
export type { Literal, ResolveResult } from './plugin/resolve.js';

export { pluginVersions, producerId } from './plugin/types.js';
export type {
  DesignFactsPlugin,
  Diagnostic,
  EmittedObservation,
  Observation,
  PluginContext,
  RawObservationValue,
} from './plugin/types.js';

export { extractFile } from './extract/extractFile.js';
export type { ExtractFileOptions, ExtractFileResult } from './extract/extractFile.js';

export {
  buildImportMap,
  isIntrinsicElement,
  jsxElementBase,
  jsxElementId,
  jsxElementIdentity,
  jsxElementName,
} from './jsx.js';
export type { ImportInfo, ImportMap } from './jsx.js';

// --- Phase 3: normalization, classification, assembly ------------------------

export { classifyCertainty } from './classify.js';

export { normalizeColor } from './normalize/color.js';
export { normalizeLength } from './normalize/length.js';
export { KEYWORD_ALIASES, normalizeKeyword } from './normalize/keyword.js';
export { normalizeProperty } from './normalize/property.js';
export { normalizeValue } from './normalize/value.js';
export { formatNumber } from './normalize/format.js';

export { assembleFact, assembleFacts, sortFacts } from './assemble.js';
export type { AssembleInput } from './assemble.js';

export { extractRepo } from './pipeline.js';
export type { ExtractRepoOptions, ExtractRepoResult } from './pipeline.js';

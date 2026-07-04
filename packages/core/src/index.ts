/**
 * @factlas/core — the deterministic fact layer.
 *
 * Public entry point. Exposes the Fact contract, the determinism spine
 * (canonical serialization, content-addressed `fact_id`, discovery + snapshot
 * header), the base parsers and plugin host, the versioned normalizers, and the
 * `extractRepo` orchestration that runs the whole layer over a repository.
 */

export type { FileCache, FileCacheEntry, PersistentFileCache } from './cache.js';
export { CACHE_FORMAT_VERSION, createDiskCache, fileCacheKey, runSignature } from './cache.js';
export { canonicalStringify, sha256Hex } from './canonical.js';
export type {
  DiscoveredFile,
  DiscoverOptions,
  DiscoverResult,
  SnapshotHeader,
} from './discover.js';
export { buildHeader, DEFAULT_EXCLUDE, DEFAULT_INCLUDE, discover } from './discover.js';
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
export type { FactDraft, FactIdInput } from './factify.js';
export { computeFactId, factify } from './factify.js';
export { TOOL_PACKAGES, toolVersions } from './tools.js';
export { FACT_SCHEMA_VERSION, NORMALIZER_VERSION } from './version.js';

// --- Phase 2: parsing, plugin host, extraction -------------------------------

export type { ExtractFileOptions, ExtractFileResult } from './extract/extractFile.js';
export { extractFile } from './extract/extractFile.js';
export type { ImportInfo, ImportMap } from './jsx.js';
export {
  buildImportMap,
  isIntrinsicElement,
  jsxElementBase,
  jsxElementId,
  jsxElementIdentity,
  jsxElementName,
} from './jsx.js';
export { babelLoc, postcssLoc } from './loc.js';
export type { ParsedModule } from './parse/babel.js';
export { BABEL_PLUGINS, parseModule, traverse } from './parse/babel.js';
export type { ParsedStylesheet } from './parse/css.js';
export { parseStylesheet } from './parse/css.js';
export type { Literal, ResolveResult } from './plugin/resolve.js';
export { DEFAULT_HOPS, resolveExpression } from './plugin/resolve.js';
export type {
  DesignFactsPlugin,
  Diagnostic,
  EmittedObservation,
  Observation,
  PluginContext,
  RawObservationValue,
} from './plugin/types.js';
export { pluginVersions, producerId } from './plugin/types.js';

// --- Phase 3: normalization, classification, assembly ------------------------

export type { AssembleInput } from './assemble.js';
export { assembleFact, assembleFacts, sortFacts } from './assemble.js';
export { classifyCertainty } from './classify.js';
export { normalizeColor } from './normalize/color.js';
export { formatNumber } from './normalize/format.js';
export { KEYWORD_ALIASES, normalizeKeyword } from './normalize/keyword.js';
export { normalizeLength } from './normalize/length.js';
export { normalizeProperty } from './normalize/property.js';
export { normalizeValue } from './normalize/value.js';
export type { ExtractRepoOptions, ExtractRepoResult } from './pipeline.js';
export { extractRepo } from './pipeline.js';

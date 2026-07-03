/**
 * Shared JSX element identity (Phase 4+ / cross-plugin linkage).
 *
 * The `element_id` foreign key on `jsx.prop`, `jsx.attribute`, and `css.class`
 * is the content-addressed `fact_id` of the owning `jsx.element`. For separate
 * plugins to produce the *same* id, they must compute the element's identity the
 * same way — so, like normalization, that logic lives here in core rather than
 * being forked across plugins. `plugin-jsx` (which emits the element) and
 * `plugin-tailwind` (which references it) both go through `jsxElementId`.
 */

import type {
  File,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXOpeningElement,
} from '@babel/types';
import type { ImportKind, JsxElementSubject } from './fact.js';
import { computeFactId } from './factify.js';
import { babelLoc } from './loc.js';
import { traverse } from './parse/babel.js';

/** An imported binding: its source module and how it was imported. */
export interface ImportInfo {
  source: string;
  kind: ImportKind;
}

/** Local-name → import info for a module. */
export type ImportMap = Map<string, ImportInfo>;

/** Build a local-name → import map for a parsed module. */
export function buildImportMap(ast: File): ImportMap {
  const map: ImportMap = new Map();
  traverse(ast, {
    ImportDeclaration: (path) => {
      const source = path.node.source.value;
      for (const spec of path.node.specifiers) {
        const kind: ImportKind =
          spec.type === 'ImportDefaultSpecifier'
            ? 'default'
            : spec.type === 'ImportNamespaceSpecifier'
              ? 'namespace'
              : 'named';
        map.set(spec.local.name, { source, kind });
      }
    },
  });
  return map;
}

type JsxName = JSXIdentifier | JSXMemberExpression | JSXNamespacedName;

/** The full authored element name, e.g. `div`, `Button`, `Foo.Bar`, `svg:rect`. */
export function jsxElementName(name: JsxName): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`;
    case 'JSXMemberExpression':
      return `${jsxElementName(name.object)}.${name.property.name}`;
  }
}

/** The leftmost identifier of a JSX name, for import lookup. */
export function jsxElementBase(name: JsxName): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return name.namespace.name;
    case 'JSXMemberExpression':
      return jsxElementBase(name.object);
  }
}

/** True for intrinsic (DOM) elements: lowercase identifiers and namespaced tags. */
export function isIntrinsicElement(name: JsxName): boolean {
  if (name.type === 'JSXIdentifier') return /^[a-z]/.test(name.name);
  if (name.type === 'JSXNamespacedName') return true;
  return false; // JSXMemberExpression (<Foo.Bar>) is always a component
}

/** Derive the `jsx.element` subject (name, imported_from, is_dom). */
export function jsxElementIdentity(node: JSXOpeningElement, imports: ImportMap): JsxElementSubject {
  const is_dom = isIntrinsicElement(node.name);
  return {
    name: jsxElementName(node.name),
    imported_from: is_dom ? null : (imports.get(jsxElementBase(node.name))?.source ?? null),
    is_dom,
  };
}

/**
 * The `fact_id` of the `jsx.element` for `node` — the value to use as an
 * `element_id` foreign key. Matches what core assigns when the element fact is
 * assembled, so cross-plugin references resolve exactly.
 */
export function jsxElementId(node: JSXOpeningElement, file: string, imports: ImportMap): string {
  return computeFactId({
    kind: 'jsx.element',
    file,
    loc: babelLoc(node),
    subject: jsxElementIdentity(node, imports),
    norm: null,
  });
}

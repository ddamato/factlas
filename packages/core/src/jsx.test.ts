import type { JSXOpeningElement } from '@babel/types';
import { describe, expect, it } from 'vitest';
import { computeFactId } from './factify.js';
import {
  buildImportMap,
  isIntrinsicElement,
  jsxElementId,
  jsxElementIdentity,
  jsxElementName,
} from './jsx.js';
import { babelLoc } from './loc.js';
import { parseModule, traverse } from './parse/babel.js';

function parse(code: string) {
  const { ast } = parseModule(code, 'App.tsx');
  const imports = buildImportMap(ast);
  const elements: JSXOpeningElement[] = [];
  traverse(ast, {
    JSXOpeningElement(path) {
      elements.push(path.node);
    },
  });
  return { imports, elements };
}

describe('buildImportMap', () => {
  it('maps local names to source + kind', () => {
    const { imports } = parse("import Def, { Named } from 'pkg';\nimport * as NS from 'ns';");
    expect(imports.get('Def')).toEqual({ source: 'pkg', kind: 'default' });
    expect(imports.get('Named')).toEqual({ source: 'pkg', kind: 'named' });
    expect(imports.get('NS')).toEqual({ source: 'ns', kind: 'namespace' });
  });
});

describe('jsxElementIdentity', () => {
  it('derives identity for DOM, imported component, and member expressions', () => {
    const { imports, elements } = parse(
      "import { Button } from '@acme/ui';\nimport * as UI from '@acme/kit';\nconst A = () => (<div><Button /><UI.Panel /></div>);",
    );
    const [div, button, panel] = elements;
    expect(jsxElementIdentity(div as JSXOpeningElement, imports)).toEqual({
      name: 'div',
      imported_from: null,
      is_dom: true,
    });
    expect(jsxElementIdentity(button as JSXOpeningElement, imports)).toEqual({
      name: 'Button',
      imported_from: '@acme/ui',
      is_dom: false,
    });
    expect(jsxElementIdentity(panel as JSXOpeningElement, imports)).toEqual({
      name: 'UI.Panel',
      imported_from: '@acme/kit',
      is_dom: false,
    });
  });
});

describe('isIntrinsicElement / jsxElementName', () => {
  it('classifies intrinsic vs component and formats names', () => {
    const { elements } = parse('const A = () => (<div><Foo /><a.b.c /></div>);');
    const [div, foo, member] = elements;
    expect(isIntrinsicElement((div as JSXOpeningElement).name)).toBe(true);
    expect(isIntrinsicElement((foo as JSXOpeningElement).name)).toBe(false);
    expect(jsxElementName((member as JSXOpeningElement).name)).toBe('a.b.c');
  });
});

describe('jsxElementId', () => {
  it('equals computeFactId of the element identity (so FKs resolve)', () => {
    const { imports, elements } = parse(
      "import { Button } from '@acme/ui';\nconst A = () => (<Button />);",
    );
    const el = elements[0] as JSXOpeningElement;
    const expected = computeFactId({
      kind: 'jsx.element',
      file: 'App.tsx',
      loc: babelLoc(el),
      subject: jsxElementIdentity(el, imports),
      norm: null,
    });
    expect(jsxElementId(el, 'App.tsx', imports)).toBe(expected);
  });
});

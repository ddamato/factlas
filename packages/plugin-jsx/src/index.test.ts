import { assembleFacts, extractFile } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import jsx from './index.js';

function facts(code: string, file = 'src/App.tsx') {
  return assembleFacts(extractFile({ file, code, plugins: [jsx] }));
}
const byKind = (fs: ReturnType<typeof facts>, k: string) => fs.filter((f) => f.kind === k);

describe('jsxPlugin — imports', () => {
  it('emits an import fact per specifier with the kind', () => {
    const fs = byKind(
      facts("import React, { useState } from 'react';\nimport './x.css';"),
      'import',
    );
    expect(fs).toHaveLength(3);
    const kinds = fs.map((f) => (f.kind === 'import' ? f.subject.import_kind : ''));
    expect(kinds).toEqual(expect.arrayContaining(['default', 'named', 'side-effect']));
    expect(fs.every((f) => f.kind === 'import' && f.value.norm !== null)).toBe(true);
  });
});

describe('jsxPlugin — elements', () => {
  it('distinguishes DOM elements from imported components', () => {
    const fs = byKind(
      facts("import { Button } from '@acme/ui';\nexport const A = () => (<div><Button /></div>);"),
      'jsx.element',
    );
    const div = fs.find((f) => f.kind === 'jsx.element' && f.subject.name === 'div');
    const button = fs.find((f) => f.kind === 'jsx.element' && f.subject.name === 'Button');
    expect(div?.kind === 'jsx.element' && div.subject.is_dom).toBe(true);
    expect(div?.kind === 'jsx.element' && div.subject.imported_from).toBeNull();
    expect(button?.kind === 'jsx.element' && button.subject.is_dom).toBe(false);
    expect(button?.kind === 'jsx.element' && button.subject.imported_from).toBe('@acme/ui');
  });
});

describe('jsxPlugin — props / attributes', () => {
  it('emits jsx.prop on components, jsx.attribute on DOM', () => {
    const fs = facts(
      'import { Button } from \'@acme/ui\';\nexport const A = () => (<Button variant="primary" disabled />);',
    );
    const props = byKind(fs, 'jsx.prop');
    const variant = props.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'variant');
    expect(variant?.kind === 'jsx.prop' && variant.value.norm).toBe('primary');
    const disabled = props.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'disabled');
    expect(disabled?.kind === 'jsx.prop' && disabled.value.norm).toBe('true'); // boolean shorthand

    const attrs = byKind(facts('export const A = () => (<input type="text" />);'), 'jsx.attribute');
    expect(attrs[0]?.kind === 'jsx.attribute' && attrs[0].subject.attribute).toBe('type');
  });

  it('links props to their element via element_id = jsx.element fact_id', () => {
    const fs = facts(
      'import { Button } from \'@acme/ui\';\nexport const A = () => (<Button variant="primary" />);',
    );
    const element = fs.find((f) => f.kind === 'jsx.element' && f.subject.name === 'Button');
    const prop = fs.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'variant');
    expect(prop?.kind === 'jsx.prop' && prop.subject.element_id).toBe(element?.fact_id);
  });

  it('classifies certainty for prop values', () => {
    const fs = facts('export const A = ({ v }) => (<X a="lit" b={v} c={ok ? "p" : "q"} />);');
    const props = byKind(fs, 'jsx.prop');
    const a = props.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'a');
    const b = props.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'b');
    const c = props.find((f) => f.kind === 'jsx.prop' && f.subject.prop === 'c');
    expect(a?.certainty).toBe('literal');
    expect(b?.certainty).toBe('dynamic'); // runtime prop
    expect(c?.certainty).toBe('static-union');
  });
});

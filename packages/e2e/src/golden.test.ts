/**
 * Golden-fixture determinism test.
 *
 * Runs the real default plugins over a checked-in sample repo and asserts the
 * assembled fact stream is byte-stable: a checked-in snapshot plus an equality
 * check across two independent runs. If normalization, hashing, or ordering ever
 * drifts, this test breaks — on purpose.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assembleFacts,
  canonicalStringify,
  discover,
  extractFile,
  type Fact,
  pluginVersions,
  type SnapshotHeader,
  sortFacts,
} from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';
import inlineStyle from '@factlas/plugin-inline-style';
import jsx from '@factlas/plugin-jsx';
import styled from '@factlas/plugin-styled';
import tailwind from '@factlas/plugin-tailwind';
import { describe, expect, it } from 'vitest';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const PLUGINS = [jsx, cssPlugin, inlineStyle, styled, tailwind];

async function run(): Promise<{ header: SnapshotHeader; facts: Fact[] }> {
  const { files, header } = await discover({
    root: FIXTURES,
    pluginVersions: pluginVersions(PLUGINS),
  });
  const all: Fact[] = [];
  for (const file of files) {
    const code = await readFile(path.join(FIXTURES, file.path), 'utf8');
    all.push(...assembleFacts(extractFile({ file: file.path, code, plugins: PLUGINS })));
  }
  return { header, facts: sortFacts(all) };
}

describe('golden fixture', () => {
  it('produces a byte-stable fact stream (checked-in snapshot)', async () => {
    const { header, facts } = await run();
    // Version-invariant view: package-version-derived fields (producer_v,
    // plugin_versions, cache_key) legitimately change on a release, so they are
    // excluded here to keep the checked-in snapshot stable across version bumps.
    // The two-run equality test below still asserts full byte-stability
    // (including versions) within a run.
    expect({
      schema_v: header.schema_v,
      normalizer_v: header.normalizer_v,
      file_count: header.file_count,
      files_digest: header.files_digest,
      facts: facts.map(({ producer_v, ...rest }) => rest),
    }).toMatchSnapshot();
  });

  it('is identical across two independent runs', async () => {
    const a = await run();
    const b = await run();
    expect(canonicalStringify(b)).toBe(canonicalStringify(a));
  });

  it('normalizes across sources and collapses equivalent values', async () => {
    const { facts } = await run();
    const cssDecls = facts.filter((f) => f.kind === 'css.declaration');

    // #FFF (stylesheet) normalized to #ffffff.
    expect(cssDecls.some((f) => f.file === 'Button.css' && norm(f) === '#ffffff')).toBe(true);
    // rgb(0,0,0) → #000000.
    expect(cssDecls.some((f) => norm(f) === '#000000')).toBe(true);
    // Inline ACCENT const '#3366FF' resolved one hop and normalized.
    expect(cssDecls.some((f) => f.file === 'Badge.tsx' && norm(f) === '#3366ff')).toBe(true);
    // Conditional fontWeight is a static-union with null norm (never compared).
    const fw = cssDecls.find(
      (f) => f.kind === 'css.declaration' && f.subject.property === 'font-weight',
    );
    expect(fw?.certainty).toBe('static-union');
    expect(norm(fw)).toBeNull();

    // Inline numeric on a dimensional property → px length (React semantics).
    const marginTop = cssDecls.find(
      (f) => f.kind === 'css.declaration' && f.subject.property === 'margin-top',
    );
    expect(marginTop?.kind === 'css.declaration' && marginTop.value.type).toBe('length');
    expect(norm(marginTop)).toBe('4px');

    // Inline numeric on a unitless property stays a plain number.
    const zIndex = cssDecls.find(
      (f) => f.kind === 'css.declaration' && f.subject.property === 'z-index',
    );
    expect(zIndex?.kind === 'css.declaration' && zIndex.value.type).toBe('number');
    expect(norm(zIndex)).toBe('2');

    // Member access into an in-file const object resolves one hop (SPACING.md → 8 → 8px).
    const gap = cssDecls.find((f) => f.kind === 'css.declaration' && f.subject.property === 'gap');
    expect(gap?.certainty).toBe('literal');
    expect(norm(gap)).toBe('8px');
  });

  it('covers all five default plugins', async () => {
    const { facts } = await run();
    const sources = new Set(facts.map((f) => f.source));
    // jsx (babel-jsx), css (plain-css), inline (inline), styled (css-in-js), tailwind.
    expect(sources).toEqual(new Set(['babel-jsx', 'plain-css', 'inline', 'css-in-js', 'tailwind']));

    // jsx: an import fact and an element with a linked prop/attribute.
    const imports = facts.filter((f) => f.kind === 'import');
    expect(imports.length).toBeGreaterThan(0);
    const element = facts.find((f) => f.kind === 'jsx.element');
    expect(element).toBeTruthy();
    const linked = facts.find(
      (f) =>
        (f.kind === 'jsx.prop' || f.kind === 'jsx.attribute') &&
        f.subject.element_id === element?.fact_id,
    );
    expect(linked).toBeTruthy();

    // Tailwind arbitrary value is flagged and typed.
    const arbitrary = facts.find(
      (f) => f.kind === 'css.class' && f.subject.token === 'text-[#123456]',
    );
    expect(arbitrary?.kind === 'css.class' && arbitrary.subject.is_arbitrary).toBe(true);
    expect(norm(arbitrary)).toBe('#123456');

    // Conditional tailwind classes are static-union.
    const conditional = facts.find(
      (f) => f.kind === 'css.class' && f.subject.token === 'bg-red-500',
    );
    expect(conditional?.certainty).toBe('static-union');

    // Cross-plugin join: a tailwind css.class links to the jsx.element it sits
    // on (element_id computed by plugin-tailwind resolves to a plugin-jsx fact).
    const linkedClass = facts.find((f) => f.kind === 'css.class' && f.subject.element_id);
    expect(linkedClass).toBeTruthy();
    const classElementId =
      linkedClass?.kind === 'css.class' ? linkedClass.subject.element_id : null;
    const ownerElement = facts.find(
      (f) => f.kind === 'jsx.element' && f.fact_id === classElementId,
    );
    expect(ownerElement).toBeTruthy();

    // Cross-plugin join: an inline css.declaration links to its owning
    // jsx.element (element_id from plugin-inline-style resolves to a plugin-jsx
    // fact), and stylesheet/styled declarations carry a null element_id.
    const inlineDecl = facts.find(
      (f) => f.kind === 'css.declaration' && f.source === 'inline' && f.subject.element_id,
    );
    expect(inlineDecl).toBeTruthy();
    const declElementId =
      inlineDecl?.kind === 'css.declaration' ? inlineDecl.subject.element_id : null;
    expect(facts.some((f) => f.kind === 'jsx.element' && f.fact_id === declElementId)).toBe(true);
    const sheetDecl = facts.find((f) => f.kind === 'css.declaration' && f.source === 'plain-css');
    expect(sheetDecl?.kind === 'css.declaration' && sheetDecl.subject.element_id).toBeNull();
  });
});

function norm(fact: Fact | undefined): string | null | undefined {
  if (!fact || !('value' in fact)) return undefined;
  return fact.value.norm;
}

import type { Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { postcssLoc } from '../loc.js';
import { traverse } from '../parse/babel.js';
import type { DesignFactsPlugin } from '../plugin/types.js';
import { extractFile } from './extractFile.js';

/** A minimal CSS plugin: emits one css.declaration per declaration. */
const cssPlugin: DesignFactsPlugin = {
  name: '@test/css',
  version: '1.0.0',
  analyzeCss(root, ctx) {
    root.walkDecls((decl) => {
      const parent = decl.parent;
      const selector = parent && parent.type === 'rule' ? (parent as Rule).selector : null;
      ctx.emit({
        kind: 'css.declaration',
        loc: postcssLoc(decl),
        source: 'plain-css',
        subject: { property: decl.prop, selector, media: null, owner_component: null },
        value: { raw: decl.value, type: 'keyword' },
      });
    });
  },
};

/** A minimal program plugin: emits one import fact per import specifier. */
const importPlugin: DesignFactsPlugin = {
  name: '@test/imports',
  version: '2.1.0',
  analyzeProgram(ast, ctx) {
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        for (const spec of path.node.specifiers) {
          ctx.emit({
            kind: 'import',
            loc: { line: 1, col: 0, endLine: 1, endCol: 1 },
            source: 'babel-jsx',
            subject: {
              specifier: source,
              local: spec.local.name,
              import_kind: spec.type === 'ImportDefaultSpecifier' ? 'default' : 'named',
            },
            value: { raw: source, type: 'module' },
          });
        }
      },
    });
  },
};

describe('extractFile', () => {
  it('routes .css files to analyzeCss and tags the producer', () => {
    const result = extractFile({
      file: 'src/Button.css',
      code: '.btn { color: red; padding: 4px; }',
      plugins: [cssPlugin, importPlugin],
    });
    expect(result.observations).toHaveLength(2);
    expect(result.observations.map((o) => o.observation.kind)).toEqual([
      'css.declaration',
      'css.declaration',
    ]);
    expect(result.observations[0]?.producer).toBe('@test/css@1.0.0');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('routes .tsx files to analyzeProgram', () => {
    const result = extractFile({
      file: 'src/Button.tsx',
      code: "import { Button } from '@acme/ui';\nexport const X = () => <Button />;",
      plugins: [cssPlugin, importPlugin],
    });
    expect(result.observations).toHaveLength(1);
    const obs = result.observations[0]?.observation;
    expect(obs?.kind).toBe('import');
    expect(result.observations[0]?.producer).toBe('@test/imports@2.1.0');
  });

  it('lets a program plugin lift a CSS carrier back into the CSS path', () => {
    const styledLike: DesignFactsPlugin = {
      name: '@test/styled',
      version: '0.0.1',
      analyzeProgram(ast, ctx) {
        traverse(ast, {
          TaggedTemplateExpression(path) {
            const quasi = path.node.quasi.quasis[0]?.value.cooked ?? '';
            const root = ctx.parseCss(`x{${quasi}}`);
            root.walkDecls((decl) => {
              ctx.emit({
                kind: 'css.declaration',
                loc: { line: 1, col: 0, endLine: 1, endCol: 1 },
                source: 'css-in-js',
                subject: {
                  property: decl.prop,
                  selector: null,
                  media: null,
                  owner_component: null,
                },
                value: { raw: decl.value, type: 'color' },
              });
            });
          },
        });
      },
    };
    const result = extractFile({
      file: 'src/Button.tsx',
      code: 'const B = styled.button`color: red;`;',
      plugins: [styledLike],
    });
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.observation.source).toBe('css-in-js');
  });

  it('turns a thrown plugin error into a diagnostic, not a crash', () => {
    const boom: DesignFactsPlugin = {
      name: '@test/boom',
      version: '9.9.9',
      analyzeProgram() {
        throw new Error('kaboom');
      },
    };
    const result = extractFile({ file: 'a.tsx', code: 'const a = 1;', plugins: [boom] });
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toEqual([
      { file: 'a.tsx', producer: '@test/boom@9.9.9', reason: 'plugin-error', message: 'kaboom' },
    ]);
  });

  it('emits a parse-error diagnostic for malformed CSS', () => {
    const result = extractFile({
      file: 'bad.css',
      code: '.a { content: "unterminated ',
      plugins: [cssPlugin],
    });
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics[0]?.reason).toBe('parse-error');
    expect(result.diagnostics[0]?.producer).toBe('@factlas/core');
  });

  it('ignores files with unsupported extensions', () => {
    const result = extractFile({ file: 'README.md', code: '# hi', plugins: [cssPlugin] });
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });
});

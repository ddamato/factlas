import { describe, expect, it } from 'vitest';
import { babelLoc, postcssLoc } from '../loc.js';
import { parseModule } from './babel.js';
import { parseStylesheet } from './css.js';

describe('parseModule', () => {
  it('parses TSX with types and JSX into a File AST', () => {
    const { ast } = parseModule(
      'const x: number = 1;\nexport const El = () => <div className="a" />;',
      'src/El.tsx',
    );
    expect(ast.type).toBe('File');
    expect(ast.program.body.length).toBeGreaterThan(0);
  });

  it('produces Babel-style 0-based columns via babelLoc', () => {
    const { ast } = parseModule('const x = 1;', 'x.ts');
    const stmt = ast.program.body[0];
    const loc = babelLoc(stmt as { loc?: never });
    expect(loc.line).toBe(1);
    expect(loc.col).toBe(0);
  });
});

describe('parseStylesheet', () => {
  it('parses CSS into a PostCSS root', () => {
    const { root } = parseStylesheet('.btn { color: red; }', 'a.css');
    const props: string[] = [];
    root.walkDecls((d) => props.push(d.prop));
    expect(props).toEqual(['color']);
  });

  it('converts PostCSS 1-based columns to 0-based via postcssLoc', () => {
    const { root } = parseStylesheet('.btn { color: red; }', 'a.css');
    const rule = root.first;
    const loc = postcssLoc(rule as Parameters<typeof postcssLoc>[0]);
    expect(loc.line).toBe(1);
    expect(loc.col).toBe(0); // PostCSS reports column 1 → 0-based 0
  });
});

import { assembleFacts, extractFile } from '@factlas/core';
import { describe, expect, it } from 'vitest';
import styled, { styledPlugin } from './index.js';

function facts(code: string, file = 'src/Button.tsx') {
  return assembleFacts(extractFile({ file, code, plugins: [styled] }));
}

const IMPORT = "import styled from 'styled-components';\n";

describe('styledPlugin', () => {
  it('extracts declarations from a styled.tag template', () => {
    const result = facts(`${IMPORT}const Button = styled.button\`color: #FFF; padding: 4px;\`;`);
    expect(result).toHaveLength(2);
    const color = result.find(
      (f) => f.kind === 'css.declaration' && f.subject.property === 'color',
    );
    expect(color?.source).toBe('css-in-js');
    if (color?.kind === 'css.declaration') {
      expect(color.value.norm).toBe('#ffffff');
      expect(color.subject.owner_component).toBe('Button');
      expect(color.certainty).toBe('literal');
    }
  });

  it('marks interpolated values dynamic with norm null', () => {
    const result = facts(`${IMPORT}const B = styled.div\`color: \${(p) => p.color};\`;`);
    expect(result).toHaveLength(1);
    if (result[0]?.kind === 'css.declaration') {
      expect(result[0].certainty).toBe('dynamic');
      expect(result[0].value.norm).toBeNull();
      expect(result[0].diagnostic).toBe('styled-interpolation');
    }
  });

  it('captures nested selectors and media within a template', () => {
    const result = facts(
      `${IMPORT}const B = styled.a\`color: red; &:hover { color: blue; } @media (min-width: 600px) { color: green; }\`;`,
    );
    const hover = result.find(
      (f) => f.kind === 'css.declaration' && f.subject.selector === '&:hover',
    );
    expect(hover).toBeTruthy();
    const media = result.find((f) => f.kind === 'css.declaration' && f.subject.media);
    expect(media?.kind === 'css.declaration' && media.subject.media).toBe('(min-width: 600px)');
  });

  it('is import-aware: ignores a styled tag not imported from a CSS-in-JS package', () => {
    const result = facts(
      'const styled = { button: () => null };\nconst B = styled.button`color: red;`;',
    );
    expect(result).toHaveLength(0);
  });

  it('recognizes emotion css and styled(Component)', () => {
    const emotion = facts("import { css } from '@emotion/react';\nconst c = css`color: red;`;");
    expect(emotion).toHaveLength(1);
    const wrapped = facts(`${IMPORT}const B = styled(Base)\`color: red;\`;`);
    expect(wrapped).toHaveLength(1);
  });

  it('accepts additional configured sources', () => {
    const plugin = styledPlugin({ sources: ['@acme/styled'] });
    const result = assembleFacts(
      extractFile({
        file: 'x.tsx',
        code: "import styled from '@acme/styled';\nconst B = styled.div`color: red;`;",
        plugins: [plugin],
      }),
    );
    expect(result).toHaveLength(1);
  });
});

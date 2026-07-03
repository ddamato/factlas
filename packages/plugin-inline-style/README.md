# @factlas/plugin-inline-style

A bundled default [Factlas](../../README.md) plugin. Extracts `css.declaration`
facts (source `inline`) from JSX `style={{ ... }}` objects.

Each style property becomes one fact. Values are resolved statically with the
bounded resolver: literals (including one-hop `const` references) become
`literal` facts, conditional literals become `union`s, and anything unresolved
becomes an honest `dynamic`/`unknown` with a diagnostic — never a silent drop.
Property keys are canonicalized to kebab-case by core, so inline
`backgroundColor` and stylesheet `background-color` collapse.

```ts
import { extractFile, assembleFacts } from '@factlas/core';
import inlineStyle from '@factlas/plugin-inline-style';

const facts = assembleFacts(
  extractFile({ file: 'Button.tsx', code, plugins: [inlineStyle] }),
);
```

**Known v1 limitation:** numeric inline values (e.g. `padding: 4`) are typed as
`number`; React's implicit `px` for length properties is not applied, so `4`
does not currently match a stylesheet's `4px`.

# @factlas/plugin-styled

A [Factlas](../../README.md) plugin. Extracts `css.declaration` facts (source
`css-in-js`) from **styled-components** and **emotion** tagged templates.

Tag recognition is import-aware: `styled.tag`, `styled(Component)`, and emotion
`css` are only treated as CSS-in-JS when their base identifier is imported from a
recognized package (`styled-components`, `@emotion/styled`, `@emotion/react`, …).
Templates are reconstructed with `${interpolations}` replaced by placeholders and
parsed by core's CSS engine; declarations containing an interpolation become
honest `dynamic` facts (never dropped).

```ts
import { extractFile, assembleFacts } from '@factlas/core';
import styled from '@factlas/plugin-styled';

const facts = assembleFacts(
  extractFile({ file: 'Button.tsx', code, plugins: [styled] }),
);
```

Add your own CSS-in-JS wrappers:

```ts
import { styledPlugin } from '@factlas/plugin-styled';
const plugin = styledPlugin({ sources: ['@acme/styled'] });
```

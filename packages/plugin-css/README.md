# @factlas/plugin-css

A bundled default [Factlas](../../README.md) plugin. Extracts `css.declaration`
facts from PostCSS stylesheets and CSS Modules — one fact per declaration, with
the enclosing selector and `@media` query attached.

Values are classified by type (color / length / number / url / shadow / keyword);
`@factlas/core` performs the actual normalization, so `#FFF` and `#ffffff`
collapse to one fact.

```ts
import { extractFile, assembleFacts } from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';

const facts = assembleFacts(
  extractFile({ file: 'Button.css', code, plugins: [cssPlugin] }),
);
```

For `*.module.css`, construct with a source tag:

```ts
import { cssPlugin } from '@factlas/plugin-css';
const modulePlugin = cssPlugin({ source: 'css-module' });
```

# @factlas/plugin-jsx

A [Factlas](../../README.md) plugin. Extracts the non-styling fact kinds from
TS/TSX: `import`, `jsx.element`, `jsx.prop`, and `jsx.attribute` (source
`babel-jsx`).

- **`import`** — one fact per specifier (`default` / `named` / `namespace` /
  `side-effect`). Powers allowed-packages policies.
- **`jsx.element`** — every JSX element, tagged `is_dom` and (for components)
  `imported_from`. Powers required/forbidden-component policies.
- **`jsx.prop`** — attributes on **component** elements (`<Button variant="…">`).
- **`jsx.attribute`** — attributes on **DOM** elements (`<div style={…}>`),
  powering no-inline-style / forbidden-attribute policies.

Props/attributes carry an `element_id` equal to the **`fact_id` of their owning
`jsx.element`** (computed with core's `computeFactId`), so you can join a prop
back to its element — e.g. "a `Button` from `@acme/ui` that also sets `variant`."

```ts
import { extractFile, assembleFacts } from '@factlas/core';
import jsx from '@factlas/plugin-jsx';

const facts = assembleFacts(extractFile({ file: 'App.tsx', code, plugins: [jsx] }));
```

Values are resolved statically (one-hop `const`, conditionals → `static-union`,
runtime props → `dynamic`), never executed.

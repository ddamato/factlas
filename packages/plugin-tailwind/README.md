# @factlas/plugin-tailwind

A [Factlas](../../README.md) plugin. Extracts `css.class` facts from Tailwind
`className`/`class` usage, including class combiners — `cn`, `clsx`,
`classnames`, `cva`, `twMerge`, `cx`.

Each class token becomes a fact carrying its **utility namespace** and whether it
uses an **arbitrary value** (`text-[#123456]`). Literal tokens pulled out of
conditionals and object forms are recorded as `static-union` (conditionally
applied); anything unresolved becomes a diagnostic — never a silent drop.

```ts
import { extractFile, assembleFacts } from '@factlas/core';
import tailwind from '@factlas/plugin-tailwind';

const facts = assembleFacts(
  extractFile({ file: 'Button.tsx', code, plugins: [tailwind] }),
);
```

## Scope

This plugin **extracts and structures** class usage — enough to power
"no-arbitrary-values" and "known-class" policies. Resolving a class to its
underlying CSS declarations via the Tailwind engine is planned future work, so:

- `tailwindcss` is an **optional peer dependency** (not required for extraction).
- Pass `tailwind.config.*` to `discover({ configFiles: [...] })` so a config
  change is folded into the snapshot header and invalidates caches.

# examples/app

A small but **real, runnable** React app — the design-system consumer that
[`examples/evaluation`](../evaluation) checks for conformance. It's a normal Vite +
React + TypeScript app: you can install it and open it in a browser.

It's deliberately **standalone** — its own `package.json`, not part of the factlas
monorepo workspace — so it reads like an ordinary app a team would build, with its
own dependencies (React, styled-components, emotion, Tailwind, cva).

## Run it

From **this folder** (`examples/app`):

```bash
npm install
npm run dev      # start the dev server, open the printed URL
# or
npm run build    # production build into dist/
npm run preview  # serve the production build
```

That's it — no monorepo setup needed. (The one cross-repo link is that it imports
the design system's tokens from the sibling [`../design-system`](../design-system)
folder, to show the app *consuming* the source of truth it's measured against.)

## What factlas sees

The same source is also the input to the evaluation demo. **factlas reads it
statically — it never runs it**, so what's evaluated is the code as written. The app
intentionally mixes every styling approach and includes realistic anti-patterns
(hardcoded colors, an inline `style`, arbitrary Tailwind values, values that can only
be known at runtime) — exactly the things a conformance check should catch.

| File | Styling approach / what it exercises |
|---|---|
| [`src/App.tsx`](./src/App.tsx) | composes the app: component usage → `jsx.element` / `jsx.prop`, local `import`s, a DOM inline-style `jsx.attribute` |
| [`src/main.tsx`](./src/main.tsx) | app entry — mounts `App` in a styled-components `ThemeProvider` |
| [`src/styles/globals.css`](./src/styles/globals.css) | plain CSS: `var()`, `@media`, hex/rgb/named colors |
| [`src/components/Button.module.css`](./src/components/Button.module.css) | CSS Module declarations, `:hover`, mixed-case hex |
| [`src/components/Button.tsx`](./src/components/Button.tsx) | styled-components: literal + interpolated (`dynamic`) declarations, nested selector, media |
| [`src/components/Alert.tsx`](./src/components/Alert.tsx) | emotion `css` tagged template |
| [`src/components/Card.tsx`](./src/components/Card.tsx) | Tailwind `cn` / `cva`, conditional (`static-union`) classes, arbitrary values |
| [`src/components/Badge.tsx`](./src/components/Badge.tsx) | inline styles: literal, one-hop `const`, conditional, cross-module member access (`unknown`), runtime prop (`dynamic`) |
| [`src/components/widgets.tsx`](./src/components/widgets.tsx) | a `Panel` imported as a namespace (`import * as widgets`) → member-expression element; wires up the CSS Module |
| [`src/legacy/LegacyModal.tsx`](./src/legacy/LegacyModal.tsx) | a local legacy component → an ordinary `import` fact |

Tokens come from [`../design-system/tokens.ts`](../design-system/tokens.ts). Because
factlas's resolver never crosses a module boundary, a token read here (e.g.
`BRAND`, `colors.danger`) is honestly `dynamic`/`unknown` at the use site — which is
why the evaluation routes such facts to `needs-review` rather than pass/fail.

To see factlas extract facts from it, from the **repo root** (after `npm run build`
there):

```bash
npx @factlas/cli extract examples/app
```

To see it evaluated against the design system, see
[`examples/evaluation`](../evaluation).

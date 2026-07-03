# examples/app

A small, intentionally varied design-system-consumer app used as the primary
**test target** for Factlas. It is not a real buildable app and has no installed
dependencies — Factlas only parses it statically, so imports need not resolve.

It exercises **every fact kind, source, and certainty level** on purpose:

| File | Exercises |
|---|---|
| `src/App.tsx` | component usage → `jsx.element` (`imported_from`), `jsx.prop` (literal/dynamic/union/boolean), a forbidden `import`, a DOM inline-style `jsx.attribute` |
| `src/styles/globals.css` | plain CSS, `var()`, `@media`, hex/rgb/named colors |
| `src/components/Button.module.css` | CSS Module declarations, `:hover`, mixed-case hex |
| `src/components/Button.tsx` | styled-components: literal + interpolated (`dynamic`) decls, nested selector, media |
| `src/components/Alert.tsx` | emotion `css` tagged template |
| `src/components/Card.tsx` | Tailwind `cn`/`cva`, conditional (`static-union`) classes, arbitrary values |
| `src/components/Badge.tsx` | inline styles: literal, one-hop `const`, conditional, member-access (`unknown`), runtime prop (`dynamic`) |
| `src/tokens.ts` | token constants for one-hop resolution |

Run the full default plugin set against it:

```bash
factlas extract examples/app
```

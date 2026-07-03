---
"@factlas/core": patch
"@factlas/plugin-tailwind": patch
---

Cross-plugin element linkage. Core now exposes shared JSX element-identity
helpers — `buildImportMap`, `jsxElementIdentity`, `jsxElementId`,
`jsxElementName`, `isIntrinsicElement` — so every plugin computes the same
content-addressed `element_id` for a given element. `plugin-tailwind` uses them
to set `element_id` on `css.class` facts, so a Tailwind class now joins back to
its owning `jsx.element` (and thus its `imported_from`). `plugin-jsx` derives its
element ids from the same helper, guaranteeing the two agree.

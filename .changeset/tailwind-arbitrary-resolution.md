---
"@factlas/plugin-tailwind": minor
---

Arbitrary Tailwind values now resolve to the `css.declaration` fact(s) they set, alongside the existing `css.class` fact. `text-[#123456]` emits a `color` declaration, `px-[10px]` emits `padding-left` / `padding-right`, and so on — so the same color/spacing policies that judge CSS also judge arbitrary Tailwind values.

The property is resolved by a deterministic, engine-free utility→property map, disambiguated by the value's type (`text-` is a color *or* a font-size, `border-` a color *or* a width). Scale/theme utilities like `bg-red-500` still need the config-driven Tailwind engine and remain `css.class`-only.

Purely additive — existing facts are unchanged; the fact schema and normalizer versions are untouched.

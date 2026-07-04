# Acme Design System — Styling Guidelines

> **Sample source material.** This is the kind of human-written guideline a design
> system publishes. Its machine-checkable form sits right next to it in
> [`policy.json`](./policy.json) — one policy per section below, each citing the
> section it came from (its `guideline`). How the prose becomes policies
> (hand-authored, or compiled by an LLM behind a deterministic validation gate) is
> the *authoring-time* concern in [DOWNSTREAM.md §5](../../../docs/DOWNSTREAM.md);
> this package ships the already-compiled `policy.json` and only *runs* it.

## color — use color tokens

Every color **must** come from a design token. Raw hex, `rgb()`, or named CSS
colors are not allowed in application code, because they can't participate in
theming and drift from the palette over time.

- ✅ `color: var(--brand)` / `className="text-brand"` / a token constant
- ❌ `color: #3a3a3a`, `background: rgb(0 0 0)`, `color: rebeccapurple`

> Compiles to **`hardcoded-color`** (error). Flags any literal `color` declaration —
> a token reference (`var(--brand)`) is a keyword fact, not a literal color, so it
> passes; unresolved values are routed to review, not failed.

## spacing — use the spacing scale

Lengths **should** come from the spacing scale (`space.*`, `radius.*`). Off-scale
pixel values fragment the rhythm of the UI.

- ✅ `padding: var(--space-sm)` / `p-2`
- ❌ `padding: 13px`, `margin-top: 7px`

> Compiles to **`hardcoded-spacing`** (warning). Flags any literal `length`
> declaration; reference a spacing/radius token instead.

## utilities — no arbitrary Tailwind values

Prefer utilities from the configured scale. **Do not** use Tailwind's arbitrary
bracket syntax (`text-[#123456]`, `w-[13px]`) — it re-introduces exactly the raw
values the scale exists to prevent.

> Compiles to **`no-arbitrary-tailwind`** (warning).

## styling — no inline styles

**Do not** use the `style={{ … }}` prop in application components. Inline styles
bypass the token system and can't be themed or audited.

- ✅ a class, a CSS Module, or a styled component driven by tokens
- ❌ `<div style={{ color: '#eee' }} />`

> Compiles to **`no-inline-style`** (warning).

## verification — unresolved values get reviewed

A value that cannot be verified statically (a runtime variable, an imported
member, a `styled` interpolation) is **never assumed compliant**. It is flagged
for human review — or, in a fuller system, a gated Tier-2 check.

> Compiles to **`needs-review`** (note). This is factlas's `dynamic`/`unknown`
> certainty, surfaced rather than silently passed or failed.

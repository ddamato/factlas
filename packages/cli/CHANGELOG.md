# @factlas/cli

## 0.0.2

### Patch Changes

- 1b1d500: Add `@factlas/plugin-jsx` to the default plugin set. It extracts the remaining
  fact kinds — `import`, `jsx.element`, `jsx.prop`, and `jsx.attribute` — with
  `element_id` linkage from each prop/attribute back to its owning element,
  completing the six-kind fact catalog. `factlas extract` now emits component
  usage, imports, and prop/attribute facts alongside the styling facts.

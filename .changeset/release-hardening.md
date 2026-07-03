---
"@factlas/cli": patch
---

Read the CLI version from `package.json` at runtime so `factlas --version`
always matches the published version (previously a hard-coded constant that could
drift). Plugins now derive their producer version the same way.

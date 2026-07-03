# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).

To record a change for release, run:

```
npm run changeset
```

Pick the affected packages and a semver bump (patch/minor/major), and write a
short summary. The generated markdown file is committed alongside your PR. On
merge to `main`, the release workflow opens a "Version Packages" PR; merging that
PR publishes the updated packages to npm.

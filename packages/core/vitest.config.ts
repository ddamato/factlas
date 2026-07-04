import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.mjs` picks up the generator drift test, which imports the plain-node
    // generate script directly (scripts/generate.mjs).
    include: ['src/**/*.test.{ts,mjs}'],
  },
});

/**
 * The default plugin bundle the CLI runs: the four Factlas defaults.
 * (Programmatic users can compose their own set and call `extractRepo` directly.)
 */

import type { DesignFactsPlugin } from '@factlas/core';
import cssPlugin from '@factlas/plugin-css';
import inlineStylePlugin from '@factlas/plugin-inline-style';
import styledPlugin from '@factlas/plugin-styled';
import tailwindPlugin from '@factlas/plugin-tailwind';

/** css → inline-style → styled → tailwind. */
export const defaultPlugins: DesignFactsPlugin[] = [
  cssPlugin,
  inlineStylePlugin,
  styledPlugin,
  tailwindPlugin,
];

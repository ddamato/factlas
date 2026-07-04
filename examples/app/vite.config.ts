import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // The app imports the design system's token binding from the sibling
    // `examples/design-system` folder, which sits above this app's root, so the
    // dev server needs permission to read one level up.
    fs: { allow: ['..'] },
  },
});

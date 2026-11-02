import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Use the library sources directly, so edits to packages/* hot-reload here.
const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@pen-ink/react/styles.css', replacement: src('core/styles.css') },
      { find: '@pen-ink/react', replacement: src('react/src/index.ts') },
      { find: '@pen-ink/core', replacement: src('core/src/index.ts') },
      { find: '@pen-ink/fonts', replacement: src('fonts/src/index.ts') },
    ],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The promo site builds against the library sources, so it always shows what's on main.
const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));
export default defineConfig({
  // GitHub Pages serves the project at /ink/. Override with BASE_PATH for a custom domain.
  base: process.env.BASE_PATH ?? '/ink/',
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

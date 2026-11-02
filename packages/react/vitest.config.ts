import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@pen-ink/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)), '@pen-ink/fonts': fileURLToPath(new URL('../fonts/src/index.ts', import.meta.url)) } },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] },
});

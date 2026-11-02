import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ["src/index.ts"], format: ["esm"], dts: true, clean: true, sourcemap: true, // no rollup treeshake: it strips the banner directive
  external: ['react', 'react-dom', '@pen-ink/core', '@pen-ink/fonts'],
  banner: { js: "'use client';" }, // React Server Components: these are client components
});

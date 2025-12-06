import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist',
});


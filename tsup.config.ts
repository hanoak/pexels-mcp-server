import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  // Prepend the shebang so the published bin is directly executable via npx.
  banner: { js: '#!/usr/bin/env node' },
})

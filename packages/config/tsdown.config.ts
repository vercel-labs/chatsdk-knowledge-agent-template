import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    sourcemap: false,
  },
  clean: true,
  hash: false,
})

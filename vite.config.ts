import { defineConfig } from 'vite';

export default defineConfig({
  // Deployed at https://<user>.github.io/schematic-v3/
  base: process.env.PAGES_BASE ?? '/schematic-v3/',
  build: {
    outDir: 'dist',
    // Vite fingerprints every asset, so a returning visitor can never get new
    // HTML with stale JavaScript. The previous tool needed a hand-maintained
    // ?v= query string on every import, which was forgotten more than once.
    assetsDir: 'assets',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});

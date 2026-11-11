import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so the build can be hosted
// from any folder (Cloudflare Pages, GitHub Pages, a sub-path, a file server).
const dataExt = process.env.DD_DATA_EXT;

export default defineConfig({
  base: './',
  plugins: [react()],
  // Unit tests only; the Playwright specs under e2e/ are run by `npm run e2e`.
  test: { include: ['tests/**/*.test.ts'] },
  // PGlite ships its own WebAssembly and data files; pre-bundling breaks how it finds them.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // PGlite's filesystem image is a ".data" file. A few static hosts only serve a fixed list of
        // extensions; for those, build with DD_DATA_EXT set (e.g. DD_DATA_EXT=wasm) to ship it under
        // an extension the host accepts. The content is unchanged and PGlite fetches it by URL.
        assetFileNames: (asset) =>
          dataExt && asset.names?.[0]?.endsWith('.data') ? `assets/[name]-[hash]-fs.${dataExt}` : 'assets/[name]-[hash][extname]',
      },
    },
  },
});

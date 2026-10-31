import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  base: process.env.DOCS_BASE || '/',
  plugins: [react()],
  build: {
    outDir: 'site',
    rollupOptions: {
      input: {
        home: resolve('index.html'),
        gallery: resolve('examples/index.html'),
        vanilla: resolve('examples/vanilla/index.html'),
        react: resolve('examples/react/index.html'),
        noBuild: resolve('examples/no-build/index.html'),
      },
    },
  },
});

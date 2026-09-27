/* Новая игра на Babylon.js и служебные страницы. Ассеты лежат в public/assets
   и копируются в сборку как есть: пути к ним относительные, чтобы dist/
   работал и с GitHub Pages, и из любой папки. */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: { port: 5178, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        viewer: resolve(import.meta.dirname, 'viewer.html')
      }
    }
  }
});

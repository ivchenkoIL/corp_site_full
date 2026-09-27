/* Сборка одной игры (без служебных страниц) для публикации: весь код —
   одним файлом js/, ассеты — как лежат в public/assets. Так сборку можно
   выложить куда угодно, хоть артефактом Claude, хоть на GitHub Pages. */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-game',
    emptyOutDir: true,
    assetsDir: 'js',
    target: 'es2022',
    chunkSizeWarningLimit: 8192,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'index.html'),
      output: { inlineDynamicImports: true }
    }
  }
});

/* Сборка старой игры из модулей src/legacy/ в один офлайн-файл —
   как исходный монолит: dist-legacy/legacy.html открывается по file://. */
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist-legacy',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    rollupOptions: { input: 'legacy.html' }
  }
});

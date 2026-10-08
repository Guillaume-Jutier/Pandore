import path from 'node:path';
import { defineConfig } from 'vite';

// The interface lives in src/renderer/ (see CLAUDE.md).
// The output folder must stay where main.js expects it.
// https://vitejs.dev/config
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(import.meta.dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});

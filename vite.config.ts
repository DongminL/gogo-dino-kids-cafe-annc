import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync } from 'fs';
import { resolve } from 'path';

function copyPublicAssetsPlugin() {
  return {
    name: 'copy-public-assets',
    closeBundle() {
      cpSync(resolve('public'), resolve('build'), {
        recursive: true,
        filter: (src) => !src.endsWith('index.html'),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPublicAssetsPlugin()],
  base: './',
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  build: {
    outDir: 'build',
    copyPublicDir: false,
  },
});

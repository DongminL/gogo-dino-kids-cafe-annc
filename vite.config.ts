import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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

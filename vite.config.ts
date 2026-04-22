import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// 빌드 시 public/ 에서 필요한 파일(오디오, 로고)만 build/ 로 복사
function copyPublicAssetsPlugin() {
  function copyRecursive(src: string, dest: string, skip: Set<string>) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    for (const entry of readdirSync(src)) {
      if (skip.has(entry)) continue;

      const srcPath = join(src, entry);
      const destPath = join(dest, entry);

      if (statSync(srcPath).isDirectory()) {
        copyRecursive(srcPath, destPath, new Set());
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  return {
    name: 'copy-public-assets',
    closeBundle() {
      copyRecursive(resolve('public'), resolve('build'), new Set(['index.html']));
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// 빌드 시 public/ 에서 필요한 파일(오디오, 로고)만 build/ 로 복사
function copyPublicAssetsPlugin() {
  return {
    name: 'copy-public-assets',
    closeBundle() {
      const srcDir = resolve('public');
      const destDir = resolve('build');
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      // electron.js, index.html 은 제외하고 나머지(wav, png 등) 복사
      const skip = new Set(['index.html', 'electron.js']);
      for (const file of readdirSync(srcDir)) {
        if (!skip.has(file)) {
          copyFileSync(join(srcDir, file), join(destDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPublicAssetsPlugin()],
  base: './',
  build: {
    outDir: 'build',
    copyPublicDir: false,
  },
});

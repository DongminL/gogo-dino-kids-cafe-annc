# 프로젝트 경량화 기록

> 작성일: 2026-03-20
> 목적: Electron 앱 exe 파일 크기 최소화

---

## 1. 현황 분석

### exe 크기 구성 요소

| 구성 요소 | 크기 | 최적화 가능 여부 |
|---|---|---|
| Electron 런타임 | ~50–70MB | ❌ 변경 불가 |
| WAV 오디오 파일 3개 | ~8.3MB | ✅ 포맷 변환으로 절약 가능 |
| React 앱 번들 (CRA) | ~1.5MB | ✅ Vite로 대폭 감소 |
| 소스맵 (.map 파일) | ~2–4MB | ✅ 빌드에서 제외 가능 |
| 미사용 런타임 의존성 | 수십 KB | ✅ 제거 가능 |

**핵심 발견**: Electron 런타임 자체는 어떻게 해도 줄일 수 없으므로,
**앱 코드 영역(~12MB)**을 집중적으로 줄이는 것이 현실적인 전략.

---

## 2. 적용한 최적화

### 2-1. CRA(Create React App) → Vite 마이그레이션

#### 변경 전 문제점
- `react-scripts 5.0.1`은 Webpack 기반으로 번들 크기가 크고 빌드가 느림
- 기본적으로 **소스맵(.map)을 생성**해 `build/` 폴더에 포함됨
- 사용하지 않는 polyfill, service worker 코드 등이 번들에 포함됨

#### 변경 후 효과

| 항목 | CRA | Vite |
|---|---|---|
| JS 번들 크기 | ~1.5MB | **202 kB** (~7.5x 감소) |
| CSS 크기 | ~20 kB | **5 kB** |
| 소스맵 | 생성됨 (~2–4MB) | **미생성** (기본값) |
| 빌드 시간 | 느림 (30초+) | **빠름 (1–2초)** |

#### 추가된 파일: `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// 빌드 시 public/ 에서 오디오·로고 파일만 build/ 로 복사하는 플러그인
function copyPublicAssetsPlugin() {
  return {
    name: 'copy-public-assets',
    closeBundle() {
      const srcDir = resolve('public');
      const destDir = resolve('build');
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
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
  base: './',           // Electron file:// 프로토콜 대응
  build: {
    outDir: 'build',
    copyPublicDir: false, // public/index.html이 생성된 index.html을 덮어쓰지 않도록
  },
});
```

#### 추가된 파일: `index.html` (프로젝트 루트)

Vite는 프로젝트 루트의 `index.html`을 빌드 엔트리포인트로 사용한다.
기존 `public/index.html`(CRA 전용)과 역할이 분리됨.

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>고고 다이노 안내 방송</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

#### 주의: `build.copyPublicDir: false` 설정 이유

Vite의 `publicDir`(기본값: `public/`)에 있는 파일은 빌드 시 `outDir`로 복사된다.
복사 순서가 "번들 생성 → publicDir 복사" 이므로, `public/index.html`이
Vite가 생성한 `build/index.html`을 **덮어쓰는 문제**가 발생한다.

`copyPublicDir: false`로 자동 복사를 막고, 커스텀 플러그인(`copyPublicAssetsPlugin`)으로
필요한 파일(`.wav`, `.png`)만 선택적으로 복사하여 해결했다.

---

### 2-2. 미사용 의존성 제거

#### `electron-is-dev` 제거 (런타임 의존성)

`electron-is-dev`는 개발/프로덕션 환경을 구분하는 라이브러리지만,
`public/electron.js`를 확인하면 이미 Electron 내장 API인 `app.isPackaged`를 사용 중이었다.

```js
// public/electron.js — electron-is-dev 를 import조차 하지 않고 있었음
if (!app.isPackaged) {
  win.loadURL('http://localhost:5173');
} else {
  win.loadFile(path.join(__dirname, '../build/index.html'));
}
```

`app.isPackaged`는 `electron-is-dev`와 동일한 역할을 하는 Electron 내장 프로퍼티다.
별도 패키지 없이 쓸 수 있으므로 `electron-is-dev`를 `dependencies`에서 완전히 제거했다.

#### 테스트 라이브러리 제거 (devDependencies)

exe 크기에는 영향 없지만(devDependencies는 패키징에 포함되지 않음),
`npm install` 속도와 `node_modules` 용량 개선을 위해 제거했다.

제거된 패키지:
- `@testing-library/dom`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@types/jest`
- `web-vitals`

---

### 2-3. TypeScript 설정 업데이트 (`tsconfig.json`)

Vite + Electron 환경에 맞게 조정했다.

| 항목 | 변경 전 | 변경 후 | 이유 |
|---|---|---|---|
| `target` | `ES5` | `ES2020` | Electron은 최신 Chromium 내장 → 모던 JS 지원 |
| `moduleResolution` | `node` | `bundler` | Vite/esbuild 번들러 방식에 최적화 |
| `lib` | `dom, dom.iterable, esnext` | `ES2020, DOM, DOM.Iterable` | target과 일치 |
| `typescript` 버전 | `^4.9.5` | `^5.0.0` | `moduleResolution: bundler`는 TS 5.0+ 필요 |

---

### 2-4. electron-builder 소스맵 제외

CRA는 기본적으로 소스맵을 생성하지만, Vite는 생성하지 않는다.
하지만 향후 CRA로 롤백하거나 Vite에서 소스맵을 활성화하더라도
프로덕션 빌드에 포함되지 않도록 `package.json`의 `files` 배열에 제외 패턴을 추가했다.

```json
"files": [
  "build/**/*",
  "!build/**/*.map",
  "public/electron.js",
  "public/logo.png"
]
```

---

### 2-5. 개발 서버 포트 변경

CRA는 `localhost:3000`, Vite는 `localhost:5173`을 기본 포트로 사용한다.

```json
// 변경 전
"electron": "concurrently \"cross-env BROWSER=none react-scripts start\" \"wait-on http://localhost:3000 && electron .\""

// 변경 후
"electron": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\""
```

`cross-env BROWSER=none`도 제거했다. CRA는 시작 시 브라우저를 자동으로 열기 때문에
`BROWSER=none`으로 억제해야 했지만, Vite는 기본적으로 브라우저를 열지 않는다.

---

## 3. 변경된 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `index.html` *(신규)* | Vite 빌드 엔트리포인트 |
| `vite.config.ts` *(신규)* | Vite 설정 + 에셋 복사 플러그인 |
| `package.json` | 의존성 정리, 스크립트 변경, electron-builder 설정 |
| `tsconfig.json` | Vite/Electron 호환 설정으로 업데이트 |
| `src/react-app-env.d.ts` | CRA 타입 → Vite 타입으로 교체 |

변경하지 않은 파일:
- `public/electron.js` — 이미 최적화된 상태
- `src/App.tsx`, `src/App.scss`, `src/index.tsx` — 변경 없음

---

## 4. 최종 빌드 결과 비교

```
[ CRA 빌드 결과 (이전) ]
build/static/js/main.abc123.js          ~1,500 kB
build/static/js/main.abc123.js.map      ~4,000 kB  ← 소스맵
build/static/css/main.abc123.css           ~20 kB
build/static/css/main.abc123.css.map       ~40 kB  ← 소스맵
build/asset-manifest.json                    2 kB  ← CRA 전용 파일
build/robots.txt                             1 kB  ← CRA 전용 파일
합계 (build/ 코드):                       ~5,600 kB

[ Vite 빌드 결과 (현재) ]
build/assets/index-Dxxxx.js               202 kB
build/assets/index-Dxxxx.css               5 kB
build/index.html                            0.4 kB
합계 (build/ 코드):                         207 kB
```

**앱 코드 부분 절약: 약 5,400 kB (~5.3MB)**

---

## 5. 추가로 할 수 있는 최적화 (미적용)

### WAV → MP3 변환 (가장 효과적, 약 7MB 추가 절약)

현재 WAV 파일 3개가 총 8.3MB를 차지한다. MP3 128kbps로 변환 시 ~0.8MB로 줄일 수 있다.

```bash
# ffmpeg 사용 (https://ffmpeg.org)
ffmpeg -i cafe-order.wav  -b:a 128k cafe-order.mp3
ffmpeg -i meal-order.wav  -b:a 128k meal-order.mp3
ffmpeg -i zip-line.wav    -b:a 128k zip-line.mp3
```

변환 후 `src/App.tsx`에서 파일 확장자 변경 필요:
```tsx
audioFile: 'cafe-order.mp3',
audioFile: 'meal-order.mp3',
audioFile: 'zip-line.mp3',
```

| 파일 | WAV | MP3 128k | 절약 |
|---|---|---|---|
| cafe-order | 3.0MB | 0.27MB | 2.7MB |
| meal-order | 2.9MB | 0.26MB | 2.6MB |
| zip-line | 2.4MB | 0.22MB | 2.2MB |
| **합계** | **8.3MB** | **0.75MB** | **7.55MB** |

---

## 6. 명령어 정리

```bash
# 개발 (Electron)
npm run electron

# 웹 브라우저에서 UI 확인만 할 때
npm run start

# 프로덕션 빌드 (build/ 폴더 생성)
npm run build

# 인스톨러 생성 (dist/ 폴더에 .exe 생성)
npm run dist
```

# Sandboxed Preload에서 `ipcChannels` Module Not Found 오류

## 문제 상황

자동 업데이트로 신버전이 설치된 직후 앱 실행 시 다음 오류가 발생하며 preload가 로드되지 않는다.

```
Unable to load preload script: .../resources/app.asar/build/electron/preload.js

Error: module not found: ./ipcChannels
  at preloadRequire (VM4 sandbox_bundle:2:145068)
  at anonymous:5:23
  at runPreloadScript (VM4 sandbox_bundle:2:144610)
  at executeSandboxedPreloadScripts (VM4 sandbox_bundle:2:157745)
```

- 개발 환경(`npm run electron`)에서는 정상 동작
- `npm run electron:build` 컴파일 자체는 오류 없이 완료됨
- `build/electron/` 디렉토리에 `ipcChannels.js` 파일이 존재하지만 런타임에서 찾지 못함

## 원인 분석

### 원인 1: Electron 20+ 기본 sandbox 적용

`src/electron/main.ts`의 `webPreferences`에 `sandbox` 옵션을 명시하지 않아 Electron 20+ 기본값 `sandbox: true`가 적용된다.

```ts
// src/electron/main.ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, "preload.js"),
  // sandbox 미지정 → Electron 20+ 기본값 sandbox: true 적용
}
```

샌드박스 preload의 `require()`는 폴리필된 제한 버전으로, `electron` / `events` / `timers` / `url`만 로드할 수 있다. **로컬 `.js` 파일은 asar 여부와 무관하게 resolve가 불가능하다.**

### 원인 2: tsc의 path alias 미리라이트

```ts
// src/electron/preload.ts
import { IPC } from "@/electron/ipcChannels";
```

`tsconfig.electron.json`의 `paths` 설정은 타입 해석 전용이며, tsc는 컴파일 출력에서 `@/` alias 경로를 **그대로 유지**한다. tsc-alias로 post-processing 시도 시, `baseUrl: "."` 설정 때문에 `electron` npm 패키지 이름까지 로컬 상대경로(`../electron`)로 잘못 리라이트되는 문제가 추가 발생한다.

### 결과

| 파일 | tsc 컴파일 결과 | 런타임 결과 |
|---|---|---|
| `preload.js` | `require("./ipcChannels")` or `require("@/electron/ipcChannels")` | sandbox require가 거부 → module not found |
| `main.js` | `require("@/electron/ipcChannels")` | Node.js가 alias 해석 불가 → 오류 |

## 해결 방법

tsc는 타입 체크 전용으로만 사용하고, **main과 preload 모두 esbuild로 번들**하여 다음 두 문제를 동시에 해결한다.

- `ipcChannels` 등 로컬 `@/` 임포트 → 번들 시 인라인 → 런타임 require 불필요
- npm 패키지(`electron`, `electron-store`, `electron-updater`) → `--external` 플래그로 런타임 require 유지

`package.json` 스크립트 변경:

```json
"main:bundle": "esbuild src/electron/main.ts --bundle --platform=node --format=cjs --target=node22 --external:electron --external:electron-store --external:electron-updater --tsconfig=tsconfig.electron.json --outfile=build/electron/main.js",
"preload:bundle": "esbuild src/electron/preload.ts --bundle --platform=node --format=cjs --target=node22 --external:electron --tsconfig=tsconfig.electron.json --outfile=build/electron/preload.js",
"electron:build": "node ./node_modules/typescript/bin/tsc -p tsconfig.electron.json && npm run main:bundle && npm run preload:bundle",
"electron:watch": "concurrently \"npm run main:bundle -- --watch\" \"npm run preload:bundle -- --watch\"",
```

> **참고: sandbox: false를 쓰지 않은 이유**
> `webPreferences`에 `sandbox: false`를 추가하면 한 줄로 해결되지만, autoUpdater로 원격 릴리즈를 받는 앱에서 Chromium 샌드박스를 비활성화하는 것은 보안상 권장되지 않는다.

## 결과

빌드 후 산출물 변화:

**`build/electron/preload.js`** — `ipcChannels` 상수가 인라인됨. 유일한 `require`는 샌드박스 허용 목록인 `require("electron")`뿐이다.

```js
// build/electron/preload.js (esbuild 번들 결과)
var import_electron = require("electron");  // 허용

var IPC = {                                 // ipcChannels 인라인
  UPDATE_AVAILABLE: "update-available",
  // ...
};
```

**`build/electron/main.js`** — `@/` alias가 모두 인라인되고, npm 패키지는 정상 require로 유지된다.

```js
// build/electron/main.js (esbuild 번들 결과)
var import_electron = require("electron");
var import_electron_store = require("electron-store");
var import_electron_updater = require("electron-updater");
// require("@/...") 또는 require("./ipcChannels") 없음
```

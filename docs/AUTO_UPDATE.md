# 자동 업데이트 시스템

`electron-updater`를 사용해 GitHub Releases에서 새 버전을 감지하고 설치하는 자동 업데이트 기능이다.

---

## 전체 흐름 요약

```
앱 시작 (3초 후)
    │
    ▼
GitHub Releases에서 latest.yml 확인
    │
    ├─ 현재 버전과 동일 ──────────────────────► 아무것도 안 함
    │
    └─ 새 버전 존재
            │
            ▼
        UI 배너 표시: "새 버전 X.X.X 출시"
        사용자가 [업데이트] 버튼 클릭
            │
            ▼
        GitHub에서 설치 파일 다운로드
        다운로드 진행률 배너 표시
            │
            ▼
        다운로드 완료
        UI 배너 표시: "지금 재시작"
        사용자가 [지금 재시작] 클릭
            │
            ▼
        앱 종료 → 설치 exe 자동 실행 (silent) → 앱 재시작
```

---

## 관련 파일 구조

```
public/
  electron.js       ← 메인 프로세스: autoUpdater 설정 및 이벤트 처리
  preload.js        ← IPC 브릿지: 메인 ↔ 렌더러 통신 채널 노출
src/
  hooks/
    useUpdater.ts   ← 업데이트 상태 관리 React 훅
  components/
    UpdateNotification/
      UpdateNotification.tsx   ← 업데이트 알림 UI 컴포넌트
      UpdateNotification.scss  ← 스타일
```

---

## 계층별 상세 설명

### 1. 메인 프로세스 — `public/electron.js`

Electron의 메인 프로세스에서 `electron-updater`의 `autoUpdater`를 설정한다.

#### 초기 설정

```js
autoUpdater.autoDownload = false;       // 사용자가 직접 다운로드 여부 선택
autoUpdater.autoInstallOnAppQuit = true; // 앱 종료 시 다운로드된 업데이트 자동 설치
```

- `autoDownload = false`: 새 버전을 감지해도 자동으로 다운로드하지 않는다.
  사용자가 UI에서 [업데이트] 버튼을 눌러야 다운로드가 시작된다.
- `autoInstallOnAppQuit = true`: 사용자가 재시작 버튼을 누르지 않고 트레이 메뉴로 앱을
  종료해도, 다운로드가 완료된 상태라면 다음 실행 시 자동 설치된다.

#### 업데이트 버전 확인

```js
// 앱 시작 3초 후 GitHub Releases에서 latest.yml 확인
if (app.isPackaged) {
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}
```

- `app.isPackaged`가 `true`일 때만 실행된다. 즉, `npm run electron`으로 개발 중
  실행할 때는 자동 확인이 동작하지 않는다.
- `package.json`의 `build.publish` 설정을 기반으로 GitHub 저장소 URL을 결정한다.

  ```json
  "publish": {
    "provider": "github",
    "owner": "DongminL",
    "repo": "gogo-dino-kids-cafe-annc"
  }
  ```

#### autoUpdater 이벤트 → 렌더러로 IPC 전달

`autoUpdater`에서 발생하는 이벤트를 `win.webContents.send()`로 렌더러 프로세스(React)에 전달한다.

| autoUpdater 이벤트 | IPC 채널명 | 전달 데이터 | 의미 |
|---|---|---|---|
| `update-available` | `update-available` | `{ version, releaseNotes, ... }` | 새 버전 존재 |
| `update-not-available` | `update-not-available` | `{ version, ... }` | 최신 버전 사용 중 |
| `download-progress` | `download-progress` | `{ percent, bytesPerSecond, transferred, total }` | 다운로드 진행 중 |
| `update-downloaded` | `update-downloaded` | `{ version, ... }` | 다운로드 완료 |
| `error` | `update-error` | 에러 메시지 (string) | 오류 발생 |

#### 렌더러에서 보내는 IPC 명령 수신

```js
ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdates());
ipcMain.on('download-update',   () => autoUpdater.downloadUpdate());
ipcMain.on('install-update',    () => {
  saveWindowBounds();
  autoUpdater.quitAndInstall(true, true); // (isSilent, isForceRunAfter)
});
```

- `isSilent = true`: 설치 UI 없이 조용히 설치된다.
- `isForceRunAfter = true`: 설치 완료 후 앱이 자동으로 재실행된다.

---

### 2. IPC 브릿지 — `public/preload.js`

Electron은 보안상 `contextIsolation: true`로 설정되어 있어서, 렌더러 프로세스(React)에서
Node.js API나 IPC에 직접 접근할 수 없다. `preload.js`가 안전한 통신 채널을
`window.electronAPI`로 노출한다.

```
메인 프로세스 (electron.js)
        │  win.webContents.send('채널명', 데이터)
        ▼
   preload.js
   ipcRenderer.on('채널명', callback)    ← Main → Renderer 수신
   ipcRenderer.send('채널명')            ← Renderer → Main 송신
        │
        ▼ contextBridge.exposeInMainWorld('electronAPI', { ... })
   window.electronAPI
        │
        ▼
  렌더러 프로세스 (React)
```

노출되는 API:

```js
window.electronAPI = {
  // 렌더러 → 메인 (명령 전송)
  checkForUpdates: () => ...,
  downloadUpdate:  () => ...,
  installUpdate:   () => ...,

  // 메인 → 렌더러 (이벤트 수신 등록)
  onUpdateAvailable:    (callback) => ...,
  onUpdateNotAvailable: (callback) => ...,
  onUpdateDownloaded:   (callback) => ...,
  onDownloadProgress:   (callback) => ...,
  onUpdateError:        (callback) => ...,

  // 리스너 정리 (메모리 누수 방지)
  removeUpdateListeners: () => ...,
}
```

---

### 3. 상태 관리 훅 — `src/hooks/useUpdater.ts`

`window.electronAPI`를 통해 IPC 이벤트를 구독하고, 업데이트 상태를 React state로 관리한다.

#### 상태 타입

```
'idle'          → 초기 상태, 아무것도 표시 안 함
'checking'      → 업데이트 확인 중 (표시 안 함)
'available'     → 새 버전 존재 → [업데이트] 버튼 표시
'not-available' → 최신 버전 사용 중 (표시 안 함)
'downloading'   → 다운로드 진행 중 → 진행률 게이지 표시
'downloaded'    → 다운로드 완료 → [지금 재시작] 버튼 표시
'error'         → 오류 발생 → 에러 메시지 표시
```

#### 상태 전이 흐름

```
idle
 │
 └─(앱 시작 3초 후, 자동)──────► checking
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                   available             not-available
                        │                    (idle로 유지)
              사용자가 [업데이트] 클릭
                        │
                        ▼
                   downloading ◄── download-progress 이벤트마다 갱신
                        │
                        ▼
                   downloaded
                        │
              사용자가 [지금 재시작] 클릭
                        │
                        ▼
                  앱 종료 후 재시작

        어느 단계에서든 오류 발생 시 → error
        사용자가 [X] 클릭 시 → idle
```

#### IPC 이벤트 구독 (useEffect)

컴포넌트 마운트 시 `window.electronAPI`의 이벤트 리스너를 등록하고,
언마운트 시 `removeUpdateListeners()`로 정리한다.

```ts
useEffect(() => {
  const api = window.electronAPI;
  if (!api) return; // 브라우저 환경(개발 서버)에서는 동작 안 함

  api.onUpdateAvailable((info) => {
    setUpdateInfo(info);     // 버전 정보 저장
    setStatus('available');  // 상태 전환
  });

  api.onDownloadProgress((progress) => {
    setDownloadProgress(progress); // percent, bytesPerSecond, ...
    setStatus('downloading');
  });

  api.onUpdateDownloaded((info) => {
    setUpdateInfo(info);
    setDownloadProgress(null);
    setStatus('downloaded');
  });

  api.onUpdateError((error) => {
    setErrorMessage(error);
    setStatus('error');
  });

  return () => api.removeUpdateListeners(); // 정리
}, []);
```

#### 외부로 노출하는 함수

| 함수 | 동작 |
|---|---|
| `checkForUpdates()` | 수동으로 업데이트 확인 요청 |
| `downloadUpdate()` | 다운로드 시작 (`status` → `'downloading'`) |
| `installUpdate()` | 앱 종료 후 silent 설치 |
| `dismiss()` | 배너 닫기 (`status` → `'idle'`) |

---

### 4. UI 컴포넌트 — `UpdateNotification.tsx`

`useUpdater`의 상태를 받아 화면 우측 하단에 토스트 형태의 배너를 표시한다.
`status`에 따라 렌더링 내용이 바뀐다.

| status | 표시 내용 |
|---|---|
| `idle` / `checking` / `not-available` | 아무것도 렌더링하지 않음 (`null` 반환) |
| `available` | "새 버전 X.X.X 출시" + [업데이트] 버튼 + [X] 버튼 |
| `downloading` | 진행률 게이지 + "다운로드 중... XX%" (닫기 불가) |
| `downloaded` | "업데이트 준비 완료" + [지금 재시작] 버튼 + [X] 버튼 |
| `error` | "업데이트 실패: {에러 메시지}" + [X] 버튼 |

`App.tsx`에서 다음과 같이 사용된다:

```tsx
const updater = useUpdater();

<UpdateNotification
  status={updater.status}
  updateInfo={updater.updateInfo}
  downloadProgress={updater.downloadProgress}
  errorMessage={updater.errorMessage}
  onDownload={updater.downloadUpdate}
  onInstall={updater.installUpdate}
  onDismiss={updater.dismiss}
/>
```

---

## 릴리스 배포 방법

### GitHub Release에 포함해야 하는 파일

`electron-updater`는 GitHub Release에서 `latest.yml`을 먼저 읽어 최신 버전 정보와
다운로드 URL, SHA512 해시를 확인한다. **두 파일 모두 업로드해야 한다.**

```
dist/
  gogo-dino-annc-setup-{version}.exe   ← 설치 파일
  latest.yml                            ← 버전 메타데이터 (필수!)
```

`latest.yml` 예시:
```yaml
version: 0.4.0
files:
  - url: gogo-dino-annc-setup-0.4.0.exe
    sha512: <hash>
    size: 12345678
path: gogo-dino-annc-setup-0.4.0.exe
sha512: <hash>
releaseDate: '2026-03-24T00:00:00.000Z'
```

### 빌드 및 배포 명령

```bash
# 로컬에서 빌드만 (dist/ 폴더에 파일 생성)
npm run dist

# 빌드 + GitHub Release에 자동 업로드 (GH_TOKEN 필요)
npm run dist:publish
```

`dist:publish`를 사용하려면 환경변수 `GH_TOKEN`에 GitHub Personal Access Token이 있어야 한다.

### CD 워크플로 (`release/*` 브랜치 → main PR 머지 시 자동 실행)

`.github/workflows/cd.yaml`이 `release/` 브랜치에서 main으로 머지될 때 자동으로
빌드 후 GitHub Release를 생성한다. Release에 `dist/*.yml`도 포함해야 자동 업데이트가 동작한다.

---

## 개발 중 UI 테스트

패키지된 앱이 아닌 개발 환경(`npm run electron`)에서는 `app.isPackaged`가 `false`이므로
실제 업데이트 확인이 실행되지 않는다. 대신 `electron.js`에 아래 코드로 가짜 이벤트를
발생시켜 UI를 테스트할 수 있다.

```js
// electron.js setupAutoUpdater() 내부
if (!app.isPackaged) {
  setTimeout(() => {
    win.webContents.send('update-available', { version: '0.2.0' });
  }, 3000);
}
```

실제 다운로드 진행 흐름을 테스트하려면 빌드 후 설치된 앱을 사용하고,
GitHub에 현재보다 높은 버전의 Release를 올려야 한다.

---

## 주의사항

- **한글 파일명 금지**: `artifactName`을 영문으로 설정해야 한다 (`package.json`에 설정됨).
  한글 파일명은 URL 인코딩 문제로 다운로드에 실패한다.
- **사용자 데이터는 보존**: 업데이트는 앱 실행 파일만 교체한다.
  `localStorage`, `IndexedDB`, `electron-store`에 저장된 스케줄·음악 데이터는 영향 없다.

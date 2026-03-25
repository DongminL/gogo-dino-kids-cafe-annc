# Feature Separation & Code Refactoring

> 이 문서는 배경 음악과 안내 방송 코드를 기능별 디렉터리로 분리하고, 대형 훅을 역할별로 분할한 리팩터링 과정을 기록합니다.

---

## 1. 배경 및 목적

### 문제점

| 항목 | 내용 |
|------|------|
| 파일 크기 | `useBgMusic.ts` 548줄 — 재생, 라이브러리, 페이드, 설정을 한 파일에서 처리 |
| 디렉터리 구조 | 배경 음악 컴포넌트/훅과 안내 방송 컴포넌트/훅이 `src/components/`, `src/hooks/`에 혼재 |
| 임포트 경로 | `../../../../utils` 같은 깊은 상대 경로로 가독성 저하 |
| 테스트 부재 | 핵심 훅(`useAudioPlayer`)에 테스트 없음 |

### 목표

1. `src/features/bg-music/`와 `src/features/announcement/`로 기능 분리
2. `useBgMusic.ts`를 역할별 훅 4개로 분할
3. `@/` 경로 별칭(alias) 도입으로 임포트 가독성 개선
4. 모든 기능에 대한 테스트 코드 작성 및 검증

---

## 2. 디렉터리 구조 변경

### Before

```
src/
├── components/
│   ├── AnnouncementCard/
│   ├── CategorySection/
│   ├── BgMusicPanel/
│   ├── GlobalBottomBar/
│   └── ScheduleSettings/
├── hooks/
│   ├── useBgMusic.ts          # 548줄 단일 파일
│   ├── useAudioPlayer.ts
│   ├── useScheduler.ts
│   └── ...
└── types/
```

### After

```
src/
├── features/
│   ├── bg-music/
│   │   ├── components/
│   │   │   └── BgMusicPanel/
│   │   ├── hooks/
│   │   │   ├── useBgMusic.ts      # 얇은 컴포지션 레이어
│   │   │   ├── useBgMusicFade.ts  # 페이드 인/아웃
│   │   │   ├── useBgMusicLibrary.ts  # 트랙/플레이리스트 CRUD
│   │   │   └── useBgMusicPlayback.ts # 오디오 재생 제어
│   │   ├── types/
│   │   │   └── bgMusic.ts         # Track, Playlist 타입 정의
│   │   └── bgMusicSettings.ts     # 설정 타입·로드/저장
│   └── announcement/
│       ├── components/
│       │   ├── AnnouncementCard/
│       │   ├── CategorySection/
│       │   └── ScheduleSettings/
│       ├── hooks/
│       │   ├── useAudioPlayer.ts
│       │   └── useScheduler.ts
│       └── types/
│           ├── announcement.ts    # AnnouncementDef 타입 정의
│           ├── category.ts        # Category 타입 정의
│           └── schedule.ts        # Schedule, ScheduleType 타입 정의
├── components/
│   ├── GlobalBottomBar/           # 앱 공통 컴포넌트는 유지
│   └── UpdateNotification/
├── db/                            # 정식 DB 모듈 (canonical)
└── hooks/                         # 앱 공통 훅 유지
```

---

## 3. `useBgMusic.ts` 훅 분할

### 분할 전략

대형 훅을 4개의 역할별 훅으로 분리하고, `useBgMusic`은 이를 조합하는 얇은 레이어로 남겼습니다.

```
useBgMusic (컴포지션)
├── usePlayback       — 오디오 객체 생성·재생·일시정지·탐색·다음/이전
├── useBgMusicFade    — 안내 방송 재생 시 페이드 인/아웃
└── useLibrary        — 트랙 추가/삭제, 플레이리스트 CRUD
```

### 공유 ref 설계

`isFadedRef`는 `usePlayback`(볼륨 적용)과 `useBgMusicFade`(페이드 상태 추적) 양쪽에서 필요합니다.
React hooks 규칙상 `useRef()`를 파라미터 객체 내부에서 호출할 수 없으므로, **`useBgMusic`에서 생성해 두 훅에 주입**합니다.

```typescript
// useBgMusic.ts
const isFadedRef = useRef(false); // 부모가 소유

const { audioRef, ... } = usePlayback({ ..., isFadedRef });
const { fadeOut, fadeIn } = useBgMusicFade(audioRef, volumeRef, isFadedRef);
```

### 각 훅 요약

| 훅 | 담당 | 입력 | 출력 |
|----|------|------|------|
| `useBgMusicPlayback` | 오디오 재생 전반 | `settingsRef`, `volumeRef`, `isFadedRef`, 초기값 | `play`, `pause`, `togglePlay`, `next`, `prev`, `seek`, `stopInternal`, 상태들 |
| `useBgMusicFade` | 페이드 인/아웃 | `audioRef`, `volumeRef`, `isFadedRef` | `fadeIn`, `fadeOut`, `clearFadeTimer` |
| `useBgMusicLibrary` | 트랙/플레이리스트 CRUD | `settingsRef`, `setSettings`, `playingPlaylistId`, `playingTrackIndexRef`, `stopInternal` | CRUD 함수들 |
| `bgMusicSettings` | 설정 타입·로드/저장 | — | `BgMusicSettings`, `loadSettings`, `defaultSettings`, `STORAGE_KEY` |

---

## 4. `@/` 경로 별칭 도입

깊은 상대 경로(`../../../../utils`) 대신 `@/` 별칭을 사용합니다.

### 설정 파일 변경

**`vite.config.ts`**
```typescript
import { resolve } from "path";
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
```

**`tsconfig.json`**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

**`jest.config.cjs`**
```javascript
moduleNameMapper: {
  "^@/(.*)$": "<rootDir>/src/$1",
  "\\.(css|scss)$": "<rootDir>/__mocks__/styleMock.js",
}
```

### SCSS 주의 사항

Sass의 `@use`는 Vite 별칭을 거치지 않고 파일 시스템에서 직접 경로를 해석합니다.
따라서 SCSS 파일에서는 `@/` 별칭을 사용할 수 없으며, 명시적인 상대 경로를 유지합니다.

```scss
/* ✗ 동작하지 않음 */
@use "@/styles/variables" as *;

/* ✓ 올바른 방법 (컴포넌트 위치 기준 상대 경로) */
@use "../../../../styles/variables" as *;
```

---

## 5. 타입 배치 원칙

타입은 **해당 기능 디렉터리 안에 직접 정의**합니다. `src/types/` 같은 전역 타입 디렉터리를 별도로 두지 않고, 기능 밖에서 타입이 필요한 경우 기능의 `types/` 경로에서 직접 import합니다.

```typescript
// src/App.tsx
import type { Schedule } from "@/features/announcement/types/schedule";

// src/components/GlobalBottomBar/GlobalBottomBar.tsx
import type { Track } from "@/features/bg-music/types/bgMusic";
```

DB 모듈(`src/db/`)은 IndexedDB 접근 레이어로 기능과 무관하게 공유되므로, feature 훅에서 직접 import합니다.

```typescript
// src/features/bg-music/hooks/useBgMusicLibrary.ts
import { saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";
```

---

## 6. 테스트

### 테스트 현황

| 테스트 파일 | 테스트 수 | 주요 검증 항목 |
|------------|----------|---------------|
| `useAudioPlayer.test.ts` | 11 (신규) | 재생·정지·탐색·볼륨·이벤트 핸들러 |
| `useBgMusic.test.ts` | 67 (이동) | 플레이리스트 CRUD, 재생 흐름, 볼륨, 페이드 |
| `useScheduler.test.ts` | 이동 | 스케줄 기반 자동 재생 트리거 |
| `AnnouncementCard.test.tsx` | 이동 | 카드 렌더링 및 상호작용 |
| 기타 | 유지 | — |
| **합계** | **99** | |

### `useAudioPlayer` 신규 테스트 범위

```
✓ 초기 상태 — playingId null, volume 1.0
✓ play() — Audio 생성, playingId 설정
✓ play() 새 항목 — 기존 오디오 정지 후 새로 재생
✓ play() 실패 — reject 시 playingId null로 복귀
✓ stop() — 오디오 정지, 상태 초기화
✓ timeupdate 이벤트 — progress 업데이트
✓ ended 이벤트 — playingId null, progress 초기화
✓ error 이벤트 — playingId null
✓ seek() — currentTime 설정
✓ setVolume() — volume 상태 업데이트
✓ setVolume() 재생 중 — audio.volume에 즉시 반영
```

### 테스트 실행

```bash
npx jest --no-coverage
```

---

## 7. 주요 버그 수정 (리팩터링 과정 발견)

### 7-1. `addEventListener` 리스너 누적

**문제**: `playAtIndex` 호출 시마다 `addEventListener("timeupdate", ...)` 누적 → 가비지 컬렉션 방해
**수정**: `audio.ontimeupdate = ...` 직접 할당 방식으로 변경 (호출마다 덮어씀)

### 7-2. `stopInternal` 미완전 정리

**문제**: `stopInternal`이 오디오를 정지할 때 `onended`, `onerror` 핸들러를 제거하지 않아 잠재적 콜백 실행 가능성 있음
**수정**: `stopInternal`에서 `ontimeupdate`, `onloadedmetadata`, `onended`, `onerror` 모두 `null`로 초기화

### 7-3. 내부 상수 불필요 노출

**문제**: `FADE_DURATION_MS`, `FADE_STEPS`가 `export const`로 공개됨
**수정**: `const`로 변경 (파일 내부 전용)

---

## 8. 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `src/features/bg-music/bgMusicSettings.ts` | 신규 (분리) |
| `src/features/bg-music/hooks/useBgMusic.ts` | 신규 (컴포지션) |
| `src/features/bg-music/hooks/useBgMusicPlayback.ts` | 신규 (분리) |
| `src/features/bg-music/hooks/useBgMusicFade.ts` | 신규 (분리) |
| `src/features/bg-music/hooks/useBgMusicLibrary.ts` | 신규 (분리) |
| `src/features/bg-music/types/bgMusic.ts` | 신규 (타입 정의 이동) |
| `src/features/announcement/types/announcement.ts` | 신규 (타입 정의 이동) |
| `src/features/announcement/types/category.ts` | 신규 (타입 정의 이동) |
| `src/features/announcement/types/schedule.ts` | 신규 (타입 정의 이동) |
| `src/types/` | 삭제 |
| `src/features/announcement/hooks/useAudioPlayer.test.ts` | 신규 (테스트) |
| `src/features/bg-music/hooks/useBgMusic.test.ts` | 이동 |
| `src/features/announcement/hooks/useScheduler.test.ts` | 이동 |
| `src/features/announcement/components/AnnouncementCard/AnnouncementCard.test.tsx` | 이동 |
| `src/App.tsx` | 수정 (임포트 경로) |
| `src/components/GlobalBottomBar/GlobalBottomBar.tsx` | 수정 (임포트 경로) |
| `vite.config.ts` | 수정 (`@` 별칭 추가) |
| `tsconfig.json` | 수정 (paths 추가) |
| `jest.config.cjs` | 수정 (moduleNameMapper 추가) |
| 4개 SCSS 파일 | 수정 (`@use` 경로 수정) |

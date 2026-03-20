# 리팩터링 기록

## 배경

`App.tsx` 하나에 모든 타입, 상수, 유틸 함수, 훅 로직, UI가 혼재되어 있었다 (~400줄).
기능이 동작하는 데는 문제가 없었지만, 코드 중복, 역할 혼재, 테스트 불가 상태를 개선하기 위해 리팩터링을 수행했다.

---

## 수정된 문제들

### 1. 코드 중복 제거

**오디오 정리(teardown) 로직 중복**

`handlePlay`와 `handleStop` 모두 동일한 5줄 정리 코드를 포함하고 있었다.

```ts
// 기존: handlePlay와 handleStop 양쪽에 중복
audioRef.current.pause();
audioRef.current.ontimeupdate = null;
audioRef.current.onended = null;
audioRef.current.onerror = null;
audioRef.current = null;
```

→ `useAudioPlayer` 훅 내부에 `cleanupAudio()` 함수로 추출하여 두 곳에서 공유한다.

---

### 2. 불필요한 ref 패턴 제거

**handlePlayRef 제거**

스케줄러 `useEffect` 내에서 stale closure를 피하려고 `handlePlayRef`를 별도로 관리했다.

```ts
// 기존
const handlePlayRef = useRef(handlePlay);
useEffect(() => { handlePlayRef.current = handlePlay; }, [handlePlay]);

// 스케줄러 내부
handlePlayRef.current(ann);
```

`handlePlay`는 `useCallback([], [])` — 의존성이 없으므로 항상 stable reference다.
`useScheduler` 훅으로 분리하면서 `onFireRef` 패턴을 훅 내부에서 처리하므로, App 레벨에서 ref를 수동으로 관리할 필요가 없어졌다.

---

### 3. 상수 중복 제거

**`categories` 배열 파생**

```ts
// 기존: CATEGORY_LABELS와 별도로 하드코딩
const categories: Category[] = ['attraction', 'closing', 'table'];

// 수정: CATEGORY_LABELS 키에서 파생 (단일 소스)
const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];
```

**`STORAGE_KEY` 상수 추출**

```ts
// 기존: 두 곳에 문자열 리터럴
localStorage.getItem('ann-schedules-v1');
localStorage.setItem('ann-schedules-v1', ...);

// 수정
export const STORAGE_KEY = "ann-schedules-v1";
```

---

### 4. 렌더링 효율 개선

카테고리별 방송 필터링이 렌더링마다 실행되고 있었다.

```ts
// 기존: 매 렌더마다 filter 3회 실행
ANNOUNCEMENT_DEFS.filter(a => a.category === cat)
```

`ANNOUNCEMENT_DEFS`는 정적 데이터이므로 모듈 수준에서 미리 계산한다.

```ts
// 수정: constants.ts에서 모듈 로드 시 1회만 계산
export const ANNOUNCEMENTS_BY_CATEGORY = (
  Object.keys(CATEGORY_LABELS) as Category[]
).reduce<Record<Category, AnnouncementDef[]>>(
  (acc, cat) => ({ ...acc, [cat]: ANNOUNCEMENT_DEFS.filter(a => a.category === cat) }),
  {} as Record<Category, AnnouncementDef[]>
);
```

---

## 파일 구조 변경

### 이전

```
src/
  App.tsx          # 모든 것이 이 파일 하나에 (~400줄)
  App.scss
  index.tsx
```

### 이후

```
src/
  styles/
    _variables.scss                     # 공통 SCSS 변수 (색상 팔레트)
  types/
    announcement.ts                     # AnnouncementDef 타입
    category.ts                         # Category 타입
    schedule.ts                         # Schedule, ScheduleType 타입
  hooks/
    useKoreanClock.ts                   # 한국 시각 클럭 훅
    useAudioPlayer.ts                   # 오디오 재생 훅
    useScheduler.ts                     # 자동 재생 스케줄러 훅
    useScheduler.test.ts
  components/
    VolumeControl/VolumeControl.tsx     # 볼륨 슬라이더
    VolumeControl/VolumeControl.scss
    AppHeader/AppHeader.tsx             # 헤더 (로고, 시각, 볼륨)
    AppHeader/AppHeader.scss
    AppHeader/AppHeader.test.tsx
    AudioControls/AudioControls.tsx     # 시크바 + 시간 표시
    AudioControls/AudioControls.scss
    AudioControls/AudioControls.test.tsx
    ScheduleSettings/ScheduleSettings.tsx  # 스케줄 설정 패널
    ScheduleSettings/ScheduleSettings.scss
    AnnouncementCard/AnnouncementCard.tsx  # 방송 카드
    AnnouncementCard/AnnouncementCard.scss
    AnnouncementCard/AnnouncementCard.test.tsx
    CategorySection/CategorySection.tsx    # 카테고리 섹션
    CategorySection/CategorySection.scss
  constants.ts                          # 상수 및 정적 데이터
  utils.ts                              # 순수 유틸 함수
  utils.test.ts
  App.tsx                               # 최상위 조합 (~50줄)
  App.scss                              # 전역 스타일 (reset, body, layout)
  index.tsx
```

---

### 5. SCSS 컴포넌트별 분리

**기존:** `App.scss` 한 파일에 전역 스타일과 모든 컴포넌트 스타일이 혼재 (~400줄).

**수정:** 공통 변수를 `src/styles/_variables.scss`로 추출하고, 각 컴포넌트 스타일을 해당 컴포넌트 폴더의 `.scss` 파일로 분리.

```
App.scss                    # 전역 스타일만 (reset, body, .app, .app-main, .app-footer)
styles/_variables.scss      # 색상 변수 ($primary, $accent, $border 등)
components/
  AppHeader/AppHeader.scss
  VolumeControl/VolumeControl.scss
  AudioControls/AudioControls.scss
  AnnouncementCard/AnnouncementCard.scss
  CategorySection/CategorySection.scss
  ScheduleSettings/ScheduleSettings.scss
```

각 `.scss` 파일은 `@use "../../styles/variables" as *`로 변수를 참조하며, 해당 컴포넌트 `.tsx`에서 직접 import한다.

---

## 컴포넌트 역할

| 컴포넌트 | 역할 |
|---|---|
| `AppHeader` | 로고, 앱 제목, 현재 시각, 볼륨 컨트롤을 포함하는 헤더 |
| `VolumeControl` | 볼륨 슬라이더 + 퍼센트 표시 |
| `CategorySection` | 카테고리 제목 + 해당 카테고리 방송 카드 목록 |
| `AnnouncementCard` | 방송 1개의 카드. 재생/정지, 시크바, 스케줄 배지, 설정 패널 포함 |
| `AudioControls` | 재생 중일 때 표시되는 시크바와 현재/전체 시간 |
| `ScheduleSettings` | 자동 재생 토글, 재생 유형 선택, 시각/간격 입력 패널 |

## 훅 역할

| 훅 | 역할 |
|---|---|
| `useKoreanClock` | 1초마다 한국 시각(Asia/Seoul)을 반환하는 클럭 |
| `useAudioPlayer` | 오디오 재생/정지/시크/볼륨 상태와 핸들러 일체 관리 |
| `useScheduler` | 현재 시각과 스케줄 설정을 보고 자동 재생 여부를 판단하여 `onFire` 콜백 호출 |

---

## 테스트 설정

### 추가된 패키지 (devDependencies)

| 패키지 | 용도 |
|---|---|
| `jest` | 테스트 러너 |
| `ts-jest` | TypeScript 변환 |
| `@types/jest` | Jest 타입 |
| `jest-environment-jsdom` | DOM 환경 시뮬레이션 |
| `@testing-library/react` | React 컴포넌트 테스트 |
| `@testing-library/jest-dom` | DOM 매처 (toBeInTheDocument 등) |
| `@testing-library/user-event` | 사용자 이벤트 시뮬레이션 |

### 설정 파일

- `jest.config.cjs` — Jest 설정 (ts-jest, jsdom, SCSS 모킹)
- `tsconfig.test.json` — Jest 호환을 위한 TypeScript 설정 오버라이드
  - `module: "CommonJS"`, `moduleResolution: "node"` (Vite용 설정과 분리)
- `src/__mocks__/fileMock.ts` — CSS/SCSS import 모킹

### 실행

```bash
npm test          # 전체 테스트 1회 실행
npm run test:watch  # 변경 감지 모드
```

---

## 테스트 목록

### `utils.test.ts` (순수 함수)

| 테스트 | 검증 내용 |
|---|---|
| `formatTime` | HH:MM:SS 포맷, 자리수 패딩, 경계값 |
| `formatDuration` | M:SS 포맷, NaN/Infinity 처리, 0초 |
| `getScheduleLabel` | enabled/type 조합별 라벨 문자열 |
| `loadSettings` | 저장값 없을 때 기본값, 저장값 있을 때 반환, 잘못된 JSON 복구 |

### `useScheduler.test.ts` (스케줄 판정 로직)

`shouldFire(schedule, hh, mm)` 순수 함수를 직접 테스트한다.

| 테스트 | 검증 내용 |
|---|---|
| `enabled=false` / `type=none` | 항상 false |
| `once` | 정확한 시:분 일치 시 true, 불일치 시 false |
| `odd-hour` | 홀수 시 정각 true, 짝수 시 또는 비정각 false |
| `even-hour` | 짝수 시 정각 true, 홀수 시 또는 비정각 false |
| `interval` | 배수 분에 true, 자정(0분) 제외, 비배수 false, 간격=0 false |

### `AudioControls.test.tsx`

| 테스트 | 검증 내용 |
|---|---|
| 시간 표시 | current/duration을 M:SS로 표시 |
| duration=0 | "0:00" 2개 표시 |
| 슬라이더 변경 | `onSeek` 콜백에 숫자값 전달 |

### `AppHeader.test.tsx`

| 테스트 | 검증 내용 |
|---|---|
| 시각 표시 | HH:MM:SS 형식으로 렌더링 |
| 로고 | alt="고고 다이노" 이미지 존재 |
| 볼륨 표시 | 퍼센트로 표시 |
| 슬라이더 변경 | `onVolumeChange` 콜백에 숫자값 전달 |

### `AnnouncementCard.test.tsx`

| 테스트 | 검증 내용 |
|---|---|
| 제목 표시 | ann.title 렌더링 |
| 재생/정지 버튼 상태 | isPlaying에 따라 상호 전환 |
| 재생/정지 클릭 | onPlay/onStop 콜백 호출 |
| AudioControls 표시 | isPlaying=true일 때만 슬라이더 표시 |
| 설정 패널 | isSettingsOpen에 따라 표시/숨김 |
| 설정 버튼 클릭 | onToggleSettings 콜백 호출 |
| 스케줄 배지 | 활성/비활성에 따라 active 클래스 부여 |

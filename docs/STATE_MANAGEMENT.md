# 상태 관리 라이브러리 비교: Redux Toolkit vs Zustand

## 배경

`App.tsx`가 커지면서 `schedules`, `bgMusic`, `activeTab` 등 여러 상태를 한 컴포넌트에서 관리하고,
이를 `CategorySection`, `BgMusicPanel`, `GlobalBottomBar` 등 하위 컴포넌트에 props로 내려주는 구조가 되었다.
전역 상태 관리 라이브러리 도입을 검토하면서 Redux Toolkit과 Zustand를 비교한다.

---

## 현재 구조의 문제

`App.tsx`는 상태 정의, 동기화 로직, UI 렌더링이 혼재되어 있다.

```ts
// App.tsx — 상태가 모두 여기에 모여 있음
const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
const [activeTab, setActiveTab] = useState<string>("all-announcements");
const [timeRangeSettings, setTimeRangeSettings] = useState<AnnouncementTimeRangeSettings>(loadTimeRangeSettings);
const [dayTypeOverride, setDayTypeOverride] = useState<DayType | null>(null);
const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
const [showTimeRangeSettings, setShowTimeRangeSettings] = useState(false);
const [showSupportModal, setShowSupportModal] = useState<"guide" | "feedback" | null>(null);
const bgMusic = useBgMusic(); // 20개 가까운 속성 반환
```

그리고 이 상태들을 여러 컴포넌트에 props로 전달한다:

```tsx
// App.tsx — 깊은 props 전달
<CategorySection
  schedules={schedules}
  playingId={playingId}
  progress={progress}
  openSettingsId={openSettingsId}
  onPlay={play}
  onStop={stop}
  onSeek={seek}
  onToggleSettings={toggleSettings}
  ...
/>

<GlobalBottomBar
  currentTrack={bgMusic.currentTrack}
  isPlaying={bgMusic.isPlaying}
  progress={bgMusic.progress}
  anncVolume={anncVolume}
  bgmVolume={bgMusic.volume}
  autoplay={bgMusic.autoplay}
  onPrev={bgMusic.prev}
  onTogglePlay={bgMusic.togglePlay}
  onNext={bgMusic.next}
  onSeek={bgMusic.seek}
  onSetAnncVolume={setAnncVolume}
  onSetBgmVolume={bgMusic.setVolume}
  ...
/>
```

---

## Redux Toolkit 도입 시

### 구조

```
src/
  store/
    index.ts           — configureStore
    schedulesSlice.ts  — 방송 스케줄 상태
    bgMusicSlice.ts    — 배경 음악 상태 (문제 있음, 후술)
```

### store 설정

```ts
// src/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { schedulesReducer } from "./schedulesSlice";

export const store = configureStore({
  reducer: {
    schedules: schedulesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### slice 작성

```ts
// src/store/schedulesSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Schedule } from "@/features/announcement/types/schedule";
import { STORAGE_KEY } from "@/constants";
import { loadSettings } from "@/utils";

interface SchedulesState {
  schedules: Record<string, Schedule>;
}

const schedulesSlice = createSlice({
  name: "schedules",
  initialState: { schedules: loadSettings() } as SchedulesState,
  reducers: {
    updateSchedule(
      state,
      action: PayloadAction<{ id: string; update: Partial<Schedule> }>
    ) {
      const { id, update } = action.payload;
      state.schedules[id] = { ...state.schedules[id], ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.schedules));
    },
  },
});

export const { updateSchedule } = schedulesSlice.actions;
export const schedulesReducer = schedulesSlice.reducer;
```

### Provider 등록

```tsx
// src/index.tsx
import { Provider } from "react-redux";
import { store } from "./store";

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
```

### 컴포넌트에서 사용

```tsx
// ScheduleSettings.tsx
import { useSelector, useDispatch } from "react-redux";
import { updateSchedule } from "@/store/schedulesSlice";
import type { RootState } from "@/store";

function ScheduleSettings({ announcementId }: { announcementId: string }) {
  const dispatch = useDispatch();
  const schedule = useSelector(
    (state: RootState) => state.schedules.schedules[announcementId]
  );

  const handleChange = (update: Partial<Schedule>) => {
    dispatch(updateSchedule({ id: announcementId, update }));
  };

  // ...
}
```

### 배경 음악(bgMusic) 적용 시 문제

`useBgMusic`은 내부적으로 `audioRef` 같은 DOM 참조를 직접 조작한다.

```ts
// useBgMusic.ts 현재 코드
const setVolume = useCallback(
  (v: number) => {
    volumeRef.current = v;
    if (audioRef.current && !isFadedRef.current) {
      audioRef.current.volume = v; // DOM 직접 접근
    }
    setSettings((prev) => ({ ...prev, volume: v }));
  },
  [audioRef]
);

const { clearFadeTimer, fadeOut, fadeIn } = useBgMusicFade(audioRef, volumeRef, isFadedRef);
```

Redux store는 직렬화 가능한 값만 저장할 수 있어 `audioRef` 같은 DOM 참조를 넣을 수 없다.
결국 store 밖에서 ref를 따로 관리하면서 store와 동기화하는 이중 구조가 생긴다.

```ts
// Redux로 bgMusic을 옮기면 이런 구조가 강제됨
// store 밖: audioRef 관리 (어딘가 전역 변수로 또는 별도 module에)
const audioRef = { current: null as HTMLAudioElement | null };

// thunk에서 store 밖 ref를 직접 참조
export const fadeOut = createAsyncThunk("bgMusic/fadeOut", async () => {
  // audioRef는 store 밖에 있어서 직접 import해서 써야 함 — 반 패턴
  if (audioRef.current) {
    audioRef.current.volume = 0;
  }
});
```

---

## Zustand 도입 시

### 구조

```
src/
  stores/
    useSchedulesStore.ts  — 방송 스케줄 상태
    useBgMusicStore.ts    — 배경 음악 상태
```

### store 작성

```ts
// src/stores/useSchedulesStore.ts
import { create } from "zustand";
import type { Schedule } from "@/features/announcement/types/schedule";
import { STORAGE_KEY } from "@/constants";
import { loadSettings } from "@/utils";

interface SchedulesStore {
  schedules: Record<string, Schedule>;
  updateSchedule: (id: string, update: Partial<Schedule>) => void;
}

export const useSchedulesStore = create<SchedulesStore>((set) => ({
  schedules: loadSettings(),
  updateSchedule: (id, update) =>
    set((state) => {
      const next = { ...state.schedules, [id]: { ...state.schedules[id], ...update } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { schedules: next };
    }),
}));
```

Provider가 필요 없다.

### 컴포넌트에서 사용

```tsx
// ScheduleSettings.tsx
import { useSchedulesStore } from "@/stores/useSchedulesStore";

function ScheduleSettings({ announcementId }: { announcementId: string }) {
  const schedule = useSchedulesStore((s) => s.schedules[announcementId]);
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule);

  const handleChange = (update: Partial<Schedule>) => {
    updateSchedule(announcementId, update);
  };

  // ...
}
```

### bgMusic에 Zustand 적용

`audioRef` 같은 DOM 참조도 store 안에 자연스럽게 보관할 수 있다.

```ts
// src/stores/useBgMusicStore.ts
import { create } from "zustand";

interface BgMusicStore {
  volume: number;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  setVolume: (v: number) => void;
  fadeOut: () => void;
  fadeIn: () => void;
}

export const useBgMusicStore = create<BgMusicStore>((set, get) => ({
  volume: loadSettings().volume,
  isPlaying: false,
  audioRef: { current: null },

  setVolume: (v) => {
    const { audioRef } = get();
    if (audioRef.current) audioRef.current.volume = v;
    set({ volume: v });
  },

  fadeOut: () => {
    const { audioRef } = get();
    if (audioRef.current) audioRef.current.volume = 0;
  },

  fadeIn: () => {
    const { audioRef, volume } = get();
    if (audioRef.current) audioRef.current.volume = volume;
  },
}));
```

`GlobalBottomBar`에서는 필요한 값만 구독한다:

```tsx
// GlobalBottomBar.tsx — props 없이 직접 구독
import { useBgMusicStore } from "@/stores/useBgMusicStore";

function GlobalBottomBar() {
  const isPlaying = useBgMusicStore((s) => s.isPlaying);
  const currentTrack = useBgMusicStore((s) => s.currentTrack);
  const volume = useBgMusicStore((s) => s.volume);
  const togglePlay = useBgMusicStore((s) => s.togglePlay);
  // ...
}
```

---

## 항목별 비교

| 항목 | Redux Toolkit | Zustand |
|------|--------------|---------|
| 보일러플레이트 | slice, actions, reducer, Provider 필요 | store 하나로 끝 |
| Provider 등록 | 필수 | 불필요 |
| `audioRef` 등 DOM 참조 | store에 넣을 수 없음 (직렬화 불가) | store 안에 자연스럽게 보관 가능 |
| 현재 hook 패턴과의 호환성 | 구조 대폭 변경 필요 | 기존 커스텀 훅을 store로 자연스럽게 전환 |
| 번들 사이즈 | ~47KB (toolkit 포함) | ~1KB |
| DevTools | Redux DevTools (강력) | zustand/middleware devtools (기본 지원) |
| TypeScript | 지원 | 지원 |
| 적합한 규모 | 대형 팀, 복잡한 상태 흐름 | 중소형 앱, hook 중심 코드베이스 |

---

## Redux가 적합한 프로젝트와의 비교

Redux는 아래 조건에서 진가를 발휘한다. 이 프로젝트와 대조하면 선택 이유가 명확해진다.

| Redux가 필요한 조건 | 이 프로젝트 |
|-------------------|------------|
| 도메인이 많고 상태가 복잡하게 얽힘 | 도메인 2개 (안내 방송 / 배경 음악) |
| 하나의 액션이 여러 도메인을 동시에 업데이트 | 도메인 간 상호작용은 "안내 방송 재생 시 bgm 페이드" 하나뿐 |
| 서버 API 비동기 흐름 관리 | 외부 API 없음 — 전부 로컬 파일/localStorage |
| 상태 변화 이력 추적, time-travel 디버깅 | 현재 상태만 맞으면 되는 앱 |
| 여러 팀이 slice 소유권을 나눠 작업 | 1인 개발 — slice 분리 의미 없음 |
| 횡단 관심사 미들웨어 (로깅, 분석, 에러 추적) | 해당 없음 |

Redux의 강점이 하나도 해당되지 않는 구조다.

---

## 결론

이 프로젝트는 다음 특성을 가진다:

- 도메인이 사실상 2개(안내 방송, 배경 음악)이고 도메인 간 상호작용이 단순함
- Electron 단일 사용자 데스크톱 앱 — 서버 API 없이 로컬 상태만 관리
- `audioRef` 등 DOM/Web API를 직접 다루는 hook 중심 코드
- 1인 개발 — 팀 간 slice 소유권 분리 불필요

Redux Toolkit은 대형 팀의 복잡한 상태 흐름을 위해 설계된 라이브러리로,
이 프로젝트에 적용하면 실질적인 이점 없이 보일러플레이트와 구조 복잡도만 높아진다.
특히 `useBgMusic`의 `audioRef` 기반 오디오 제어 로직은 Redux 패턴과 근본적으로 맞지 않는다.

**Zustand가 이 프로젝트에 적합하다.** 기존 커스텀 훅 구조를 그대로 store로 전환할 수 있고,
DOM 참조 문제도 없으며, `App.tsx`의 props drilling을 간단하게 해소할 수 있다.

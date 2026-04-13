# Zustand Slice Pattern 적용 — `useBgMusicStore`

## 배경

Zustand를 도입한 직후 `useBgMusicStore`는 하나의 파일에서 재생, 페이드, 라이브러리 관련 상태와 액션을 모두 정의하는 구조였다.  
store가 커질수록 파일이 비대해지고, 관심사가 뒤섞여 유지보수가 어려워졌다.

이를 해결하기 위해 Zustand 공식 문서에서 권장하는 **slice pattern**을 적용했다.

> **Zustand 공식 권장 방식**  
> Zustand docs — [Slices Pattern](https://zustand.docs.pmnd.rs/learn/guides/slices-pattern):  
> "As your application grows bigger, you might want to modularize your store into smaller, more manageable pieces."  
> 각 도메인 로직을 `create*Slice` 팩토리 함수로 분리하고, `create()` 호출 시 spread로 합치는 방식을 권장한다.

---

## 적용 전: 비대해진 단일 store

적용 전에는 재생, 페이드, 라이브러리 로직이 하나의 `useBgMusicStore.ts`에 섞여 있었다.

```
src/stores/
  useBgMusicStore.ts   ← 모든 로직이 한 파일에 집중
```

파일 하나가 수백 줄에 달했고, 서로 다른 관심사(재생 제어 / 페이드 / 라이브러리 관리)가 한 곳에 뒤엉켜 있었다.

---

## 적용 후: slice 분리 구조

```
src/stores/
  useBgMusicStore.ts      ← store 조립 진입점 (ctx 정의 + slice 합성)
  createPlaybackSlice.ts  ← 재생 제어 (play, pause, next, prev, seek ...)
  createFadeSlice.ts      ← 페이드 인/아웃 (fadeOut, fadeIn, clearFadeTimer)
  createLibrarySlice.ts   ← 라이브러리/플레이리스트 관리 (addTrack, createPlaylist ...)
```

---

## 핵심 구조

### 1. 각 slice는 팩토리 함수

Redux의 `createSlice()`와 개념은 유사하지만, Zustand에서는 `create()` 바깥의 **일반 함수**로 작성한다.  
`set`, `get`, 그리고 공유 ref들을 담은 `ctx`를 인자로 받아 해당 slice의 상태와 액션 객체를 반환한다.

```ts
// createPlaybackSlice.ts
export function createPlaybackSlice(
  set: PlaybackSet,
  get: PlaybackGet,
  ctx: PlaybackCtx,
  initialSettings: BgMusicSettings,
): PlaybackSlice {
  // ... 내부 함수 정의 ...

  return {
    isPlaying: false,
    playingPlaylistId: initialSettings.currentPlaylistId,
    // ...
    play: (index?) => { /* ... */ },
    togglePlay: () => { /* ... */ },
    next: () => { /* ... */ },
  };
}
```

### 2. 공유 ref는 store 바깥에서 module 스코프로 관리

`audioRef`, `volumeRef` 등 직렬화 불가한 DOM/타이머 참조는 `useBgMusicStore.ts`의 **module 스코프**에 선언하고, `ctx` 객체로 묶어 각 slice에 주입한다.

이것이 Zustand가 Redux보다 이 구조에 자연스러운 이유다.  
Redux store는 직렬화 가능한 값만 저장할 수 있어 `audioRef` 같은 DOM 참조를 store에 넣을 수 없다.  
Zustand는 제약이 없으므로 ref를 store 안팎 어디서든 자유롭게 다룰 수 있다.

```ts
// useBgMusicStore.ts — module 스코프 ref 선언
const audioRef = { current: null as HTMLAudioElement | null };
const volumeRef = { current: 0.7 };
const isFadedRef = { current: false };
const fadeTimerRef = { current: null as ReturnType<typeof setInterval> | null };
// ...

const ctx = {
  audioRef, objectUrlRef, volumeRef, isFadedRef,
  playingTrackIndexRef, playGenerationRef,
  bgMusicInitializedRef, fadeTimerRef,
  revokeObjectUrl, saveSettings, startWatchdog, stopWatchdog,
};
```

### 3. `create()` 호출부에서 spread로 합성

Zustand docs의 권장 방식 그대로, `create()` 내부에서 각 `create*Slice` 결과를 spread로 합쳐 하나의 store를 구성한다.

```ts
// useBgMusicStore.ts
export const useBgMusicStore = create<BgMusicStore>((set, get) => ({
  settings: initialSettings,
  ...createPlaybackSlice(set, get, ctx, initialSettings),
  ...createFadeSlice({ audioRef, volumeRef, isFadedRef, fadeTimerRef }),
  ...createLibrarySlice(set, get, ctx),
}));
```

### 4. 타입은 각 slice 인터페이스를 상속

store의 타입을 각 slice 인터페이스의 합집합으로 선언한다.  
slice 하나의 타입을 변경하면 store 타입에 자동으로 반영된다.

```ts
export interface BgMusicStore extends PlaybackSlice, FadeSlice, LibrarySlice {
  settings: BgMusicSettings;
}
```

---

## Zustand 특성을 살린 설계 포인트

### `get()`으로 slice 간 참조

Zustand의 `get()`은 항상 현재 store 전체를 반환한다.  
`createPlaybackSlice`에서 `get().settings`로 `settings`를 읽거나, `get().stopInternal()`로 다른 slice의 액션을 호출할 수 있다.  
slice가 분리되어 있어도 하나의 store이기 때문에 이 참조가 항상 유효하다.

```ts
// createLibrarySlice.ts — 다른 slice의 액션을 get()으로 호출
removeTrack: async (trackId) => {
  const state = get();
  if (trackIds[ctx.playingTrackIndexRef.current] === trackId) {
    state.stopInternal(); // PlaybackSlice의 액션을 그대로 호출
  }
  // ...
},
```

### selector로 파생 상태 분리

컴포넌트에서 구독할 때는 필요한 값만 뽑는 selector를 사용한다.  
파생 상태(현재 재생 트랙, 현재 플레이리스트)는 store 외부의 순수 selector 함수로 분리해 재사용성을 높였다.

```ts
// useBgMusicStore.ts
export function selectBgMusicCurrentTrack(state: BgMusicStore): Track | null {
  const { settings, playingPlaylistId, playingTrackIndex } = state;
  const playlist = settings.playlists.find((p) => p.id === playingPlaylistId) ?? null;
  if (playlist) {
    return settings.trackMeta.find((t) => t.id === playlist.trackIds[playingTrackIndex]) ?? null;
  }
  return playingPlaylistId === null ? (settings.trackMeta[playingTrackIndex] ?? null) : null;
}
```

컴포넌트에서는 다음과 같이 사용한다:

```tsx
const currentTrack = useBgMusicStore(selectBgMusicCurrentTrack);
```

### Provider 없이 module 단위 singleton

Zustand store는 `create()` 호출 시 즉시 module 스코프 singleton으로 생성된다.  
context Provider를 트리 상단에 배치할 필요가 없고, 어느 컴포넌트에서든 import만으로 바로 구독할 수 있다.

---

## slice별 역할 요약

| slice | 파일 | 주요 액션 |
|-------|------|----------|
| `PlaybackSlice` | `createPlaybackSlice.ts` | `play`, `togglePlay`, `next`, `prev`, `seek`, `setVolume`, `setAutoplay`, `init`, `stopInternal` |
| `FadeSlice` | `createFadeSlice.ts` | `fadeOut`, `fadeIn`, `clearFadeTimer` |
| `LibrarySlice` | `createLibrarySlice.ts` | `addTrack`, `removeTrack`, `createPlaylist`, `deletePlaylist`, `setCurrentPlaylist`, `addTrackToPlaylist`, `setLoop`, `reorderTrack` |

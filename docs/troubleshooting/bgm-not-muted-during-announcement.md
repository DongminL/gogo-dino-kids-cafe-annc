# 안내 방송 재생 중 배경 음악이 음소거되지 않는 문제

## 문제 상황

1. 앱을 실행한다.
2. 배경 음악을 재생하지 않고 안내 방송을 먼저 재생한다.
3. 안내 방송이 재생 중인 상태에서 배경 음악을 재생한다.
4. 배경 음악이 볼륨 그대로 재생되며, 안내 방송과 동시에 소리가 겹친다.

## 원인 분석

`App.tsx`는 `playingId`(현재 재생 중인 안내 방송 ID)의 변화를 감지해 배경 음악을 페이드 아웃/인한다.

```ts
// App.tsx
useEffect(() => {
  if (playingId) {
    bgMusic.fadeOut(); // 안내 방송 시작 → 배경 음악 페이드 아웃
  } else {
    bgMusic.fadeIn();  // 안내 방송 종료 → 배경 음악 페이드 인
  }
}, [playingId]);
```

`useBgMusicFade.ts`의 `fadeOut()`은 페이드 애니메이션을 위해 `audioRef.current`(배경 음악 오디오 엘리먼트)가 존재하는지 먼저 확인하고 있었다.

```ts
// 수정 전
const fadeOut = useCallback(() => {
  if (!audioRef.current || isFadedRef.current) return; // ← 오디오가 없으면 조기 반환
  isFadedRef.current = true;
  // ...
}, [...]);
```

안내 방송 시작 시점에 배경 음악이 재생 중이 아니면 `audioRef.current`가 `null`이므로, `isFadedRef.current = true` 설정 없이 함수가 반환된다.

이후 배경 음악을 재생하면 `useBgMusicPlayback.ts`의 `playAtIndex()`에서 아래 코드가 실행된다.

```ts
audio.volume = isFadedRef.current ? 0 : volumeRef.current;
```

`isFadedRef.current`가 `false`인 채로 남아 있기 때문에, 안내 방송이 재생 중임에도 배경 음악이 정상 볼륨으로 시작된다.

## 해결 방법

`isFadedRef.current` 플래그 설정을 `audioRef.current` 존재 확인보다 먼저 하도록 순서를 변경한다. 오디오가 없으면 페이드 애니메이션만 건너뛰고, 플래그는 항상 올바르게 설정된다.

```ts
// useBgMusicFade.ts — 수정 후
const fadeOut = useCallback(() => {
  if (isFadedRef.current) return;
  isFadedRef.current = true;   // ← 오디오 유무와 무관하게 먼저 설정
  if (!audioRef.current) return;
  // 페이드 애니메이션...
}, [...]);

const fadeIn = useCallback(() => {
  if (!isFadedRef.current) return;
  isFadedRef.current = false;  // ← 오디오 유무와 무관하게 먼저 초기화
  if (!audioRef.current) return;
  // 페이드 애니메이션...
}, [...]);
```

## 테스트 케이스

`src/features/bg-music/hooks/useBgMusic.test.ts`의 `볼륨 및 페이드` 섹션에 아래 3가지 회귀 테스트를 추가했다.

| 테스트 | 시나리오 | 검증 |
|---|---|---|
| 안내 방송 재생 중 배경 음악 시작 시 볼륨 0으로 재생 | `fadeOut()` (오디오 없음) → `play()` | `audio.volume === 0` |
| fadeOut → fadeIn 후 배경 음악 재생 시 정상 볼륨으로 시작 | `fadeOut()` → `fadeIn()` (오디오 없음) → `play()` | `audio.volume === targetVolume` |
| fadeOut 중복 호출 시 두 번째는 무시됨 | `fadeOut()` 두 번 연속 호출 | 페이드 애니메이션 정상 완료 |

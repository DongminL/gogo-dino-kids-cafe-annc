# 배경 음악이 장시간 재생 후 갑자기 멈추는 문제

## 문제 상황

- 약 1시간 이상 배경 음악 재생 중 안내 방송 없이 갑자기 소리가 멈춘다.
- UI의 재생 버튼은 여전히 재생 중 상태(정지 버튼이 눌리지 않음)이다.
- 재생 버튼을 두 번(정지 → 재생) 누르면 정상 복구된다.

## 원인 분석

Electron은 Chromium 기반이기 때문에, Windows 오디오 세션(WASAPI) 또는 Chromium 내부 오디오 렌더러가 장시간 실행 후 오디오를 자동으로 suspend(일시 중단)하는 경우가 있다.

이 때 `HTMLAudioElement`의 `onended` 이벤트가 발생하지 않아 `isPlaying` 상태는 `true`를 유지하지만, 실제 오디오 재생은 멈추게 된다.

재생 버튼을 두 번 눌러야 복구되는 이유는 `togglePlay` 로직 때문이다.

1. **1번 클릭**: `isPlaying=true` → `pause()` 호출 → `setIsPlaying(false)`. `audioRef.current`는 null이 아닌 채로 유지된다.
2. **2번 클릭**: `isPlaying=false` + `audioRef.current` 존재 → `audioRef.current.play()` 호출 → suspend 상태에서 resume된다.

## 해결 방법

`useBgMusic.ts`에 워치독 타이머를 추가한다. `isPlaying`이 `true`인 동안 10초마다 오디오 엘리먼트가 예기치 않게 pause 상태인지 확인하고, 그럴 경우 자동으로 resume한다.

```ts
useEffect(() => {
  if (!isPlaying) return;
  const interval = setInterval(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, 10000);
  return () => clearInterval(interval);
}, [isPlaying]);
```

### 인터벌을 10초로 설정한 이유

- 음악이 멈춘 후 손님이 인식하기까지 약 10~20초가 소요된다.
- 손님이 직원에게 알리거나 직원이 직접 인식하기까지 추가 20~40초가 소요된다.
- 실제 대응까지 총 30~60초가 걸리므로, **10초 이내에 자동 복구되면 아무도 인식하지 못하고 지나간다.**

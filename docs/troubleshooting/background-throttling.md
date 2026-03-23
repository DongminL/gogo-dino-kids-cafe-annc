# 창을 숨기면 배경음악 중단 및 안내방송 미재생 문제

## 문제 상황

- 배경음악 볼륨을 0으로 설정하고 반복 재생 중 창을 닫으면 음악이 중간에 멈춘다.
- 창을 트레이로 숨긴 상태에서 정해진 시간에 안내방송이 재생되지 않는다.
- 볼륨이 있을 때는 괜찮지만 볼륨 0일 때 유독 문제가 발생한다.

## 원인 분석

### Chromium Background Throttling

Electron은 Chromium 기반이므로 `win.hide()`로 창을 숨기면 렌더러 프로세스의 `document.visibilityState`가 `"hidden"`으로 변경된다. 이 시점에 Chromium의 **background throttling**이 자동 활성화된다.

Background throttling이 활성화되면 다음이 제한된다.

- `setInterval` / `setTimeout` 등 JS 타이머가 스로틀링됨 (최소 1초 이상 간격 강제)
- 오디오 세션이 비활성 상태로 간주되면 자동 suspend 대상이 됨

### 볼륨 0이 문제를 악화시키는 이유

볼륨이 0이 아닌 경우, Chromium은 해당 오디오 세션을 "활성 오디오 출력 중"으로 인식하여 스로틀링을 상대적으로 덜 적용한다.

반면 볼륨이 0이면 실제 소리 출력이 없으므로 Chromium이 해당 오디오를 "중요하지 않다"고 판단하여 더 공격적으로 suspend 대상으로 처리한다.

### 영향 범위

| 기능 | 영향 |
|---|---|
| 배경음악 재생 (볼륨 0) | 트랙이 중간에 멈추거나 다음 트랙으로 넘어가지 않음 |
| 배경음악 Watchdog | setInterval이 스로틀링되어 suspend 감지 및 복구가 크게 지연됨 |
| 안내방송 스케줄러 | setInterval/setTimeout 기반 스케줄이 지연되어 정해진 시간에 방송이 안 나올 수 있음 |

안내방송 미재생은 이 앱의 핵심 기능 자체를 손상시키므로 가장 심각한 영향이다.

## 해결 방법

`electron.js`의 `BrowserWindow` 생성 시 `webPreferences`에 `backgroundThrottling: false`를 추가한다.

```js
win = new BrowserWindow({
  // ...
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    backgroundThrottling: false, // 창이 숨겨져도 JS 타이머·오디오 정상 동작
  },
});
```

`backgroundThrottling: false`는 "스로틀링을 비활성화"한다는 의미로, 창이 숨겨진 상태에서도 타이머와 오디오가 정상적으로 동작하도록 보장한다.

## bgm-audio-suspension.md와의 관계

[bgm-audio-suspension.md](./bgm-audio-suspension.md)에서 다루는 "장시간 재생 후 오디오 suspend" 문제와 원인은 다르지만 서로 연관된다.

- **bgm-audio-suspension.md**: WASAPI/Chromium 오디오 렌더러가 장시간 실행 후 자체적으로 suspend하는 문제 → Watchdog으로 해결
- **이 문서**: 창이 숨겨질 때 background throttling으로 인해 Watchdog 자체가 스로틀링되어 복구가 지연되는 문제 → `backgroundThrottling: false`로 해결

두 설정을 함께 적용해야 완전한 해결이 된다.

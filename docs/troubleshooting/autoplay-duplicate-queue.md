# 자동 재생 중복 문제 (fix/#39)

## 1. 문제 상황

스케줄러가 같은 분(minute)에 두 가지 유형의 안내 방송을 동시에 발화할 때 두 가지 버그가 발생했다.

**재현 조건**
- `dance-trampoline`: `interval` 30분 설정 → 18:00 발화
- `meal-order`: `once` 18:00 설정 → 18:00 발화
- 두 스케줄이 같은 분에 겹침

**Bug 1 – 시각 설정 안내 방송이 묵살됨**
`ANNOUNCEMENT_DEFS.forEach` 순서상 `dance-trampoline(index 0)`이 먼저 발화하고 `meal-order(index 3)`가 뒤따른다. `play()`는 매번 `cleanupAudio()`를 먼저 실행하므로 두 번째 `play()` 호출이 첫 번째 오디오를 즉시 중단했다. 결과적으로 마지막으로 호출된 방송만 재생됐다.

**Bug 2 – 재생 중 UI 표시(■ 정지)가 사라짐**
`play(ann1)` → `audio1.play()` (비동기 시작) → `play(ann2)` → `audio1.pause()` 순으로 실행될 때, `audio1.play()` Promise가 `pause`로 인해 `AbortError`로 reject됐다. `.catch()` 핸들러가 `set({ playingId: null })`을 실행해 `ann2`가 재생 중임에도 UI에서 ■ 정지 버튼이 사라졌다.

---

## 2. 원인 분석

| 구분 | 원인 |
|------|------|
| Bug 1 | `play()`가 매번 `cleanupAudio()`를 호출하여 이전 오디오를 무조건 중단 |
| Bug 2 | `audio.play()` Promise reject 시 `.catch()`가 무조건 `playingId: null`로 초기화 — 세대(generation) 개념 없이 구버전 catch가 현재 재생 상태를 덮어씀 |

**공통 근본 원인**: 스케줄러가 여러 방송을 동기적으로 `play()`에 직접 연결하는 구조였기 때문에 동시 발화 시 재생 상태를 덮어쓰는 것을 막을 방법이 없었다.

---

## 3. 해결 방법

### `useAudioPlayerStore.ts` — 큐(Queue) + 세대 카운터 도입

**모듈 레벨 ref 추가**

```ts
interface QueueItem {
  ann: AnnouncementDef;
  priority: number; // 낮을수록 먼저 재생
}
const queueRef = { current: [] as QueueItem[] };
const playGenerationRef = { current: 0 };
```

**`playAudio()` 헬퍼 함수 추출**

```ts
function playAudio(ann: AnnouncementDef) {
  cleanupAudio();
  const generation = ++playGenerationRef.current; // 세대 증가

  const handleEnd = () => {
    audioRef.current = null;
    if (queueRef.current.length > 0) {
      playAudio(queueRef.current.shift()!.ann); // 다음 큐 자동 재생
    } else {
      set({ playingId: null, ... });
    }
  };

  audio.play().catch(() => {
    if (playGenerationRef.current === generation) { // 구버전 catch 차단
      handleEnd();
    }
  });
}
```

- 세대 카운터: `.catch()`가 실행될 시점에 자신이 현재 세대인지 확인. 구버전(중단된 오디오)의 catch는 무시됨 → Bug 2 해결
- `handleEnd`의 큐 dequeue: 재생이 끝나면 자동으로 다음 항목 재생

**`enqueue()` 액션 추가**

```ts
enqueue: (ann, priority = 1) => {
  if (audioRef.current === null) {
    playAudio(ann);       // 유휴 상태면 즉시 재생
  } else {
    // 우선순위 큐: 낮은 priority가 앞에 오도록 삽입
    const idx = queueRef.current.findIndex((q) => q.priority > item.priority);
    if (idx === -1) queueRef.current.push(item);
    else queueRef.current.splice(idx, 0, item);
  }
},
```

- 재생 중인 오디오를 건드리지 않으므로 AbortError 발생 자체를 차단 → Bug 1, Bug 2 동시 해결

### `useScheduler.ts` — 우선순위 맵 + `onFire` 시그니처 변경

```ts
const SCHEDULE_PRIORITY: Record<string, number> = {
  once: 0, "odd-hour": 0, "even-hour": 0, interval: 1,
};

// onFire 시그니처
onFire: (ann: AnnouncementDef, priority: number) => void

// forEach 내부
const priority = SCHEDULE_PRIORITY[schedule.type] ?? 1;
onFireRef.current(ann, priority);
```

- 시각 설정(once / odd-hour / even-hour) = priority 0 (더 중요)
- 반복 간격(interval) = priority 1
- 스케줄러는 priority 값만 전달하고, 큐 정렬은 store가 담당

### `App.tsx` — 스케줄러 콜백 교체

```ts
// 변경 전
useScheduler(..., play);

// 변경 후
const { playingId, play, enqueue } = useAudioPlayerStore();
useScheduler(..., enqueue);
```

---

## 4. 결과

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| Bug 1 | 마지막 발화 방송만 재생 | 발화 순서대로 큐에 쌓여 순차 재생 |
| Bug 2 | 두 번째 방송 시작 시 UI ■ 정지 사라짐 | 현재 재생 방송의 UI 상태 유지 |
| 수동 재생 | 정상 | 변경 없음 (`play()`는 큐 초기화 후 즉시 재생) |
| stop() | 현재 오디오만 중단 | 큐도 함께 초기화 |

**E2E 테스트 추가** (`e2e/autoplay-queue.spec.ts`)

| 테스트 | 검증 내용 |
|--------|-----------|
| `[Bug 1]` 동시 발화 시 먼저 발화한 방송이 중단되지 않는다 | 첫 번째 카드만 ■ 정지 표시, 두 번째 카드는 대기 |
| `[Bug 2]` 재생 UI 상태가 null로 초기화되지 않는다 | 동시 발화 후 ■ 정지 버튼이 지속 표시됨 |
| 세 방송 동시 발화 시 한 방송만 재생 상태 | ■ 정지 버튼이 정확히 1개 |
| 단독 발화 시 enqueue가 즉시 재생 | 기본 동작 회귀 확인 |

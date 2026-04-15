import { test, expect } from "@playwright/test";

/**
 * 자동 재생 큐 E2E 테스트 – #39 동시 발화 중복 문제 수정 검증
 *
 * 수정 전 버그:
 *   Bug 1 – 두 번째 play() 호출이 첫 번째 오디오를 cleanupAudio()로 즉시 중단
 *   Bug 2 – 첫 번째 audio.play() Promise가 AbortError로 reject되어
 *            .catch()에서 playingId: null로 초기화 → UI 표시가 사라짐
 *
 * 테스트 시각: 2024-01-17(수) 18:00:00 KST (평일 자동 재생 시간대 내)
 *   - dance-trampoline: interval 30분 → 18:00에 발화 (priority 1)
 *   - meal-order: once 18:00 → 18:00에 발화 (priority 0)
 *   - ANNOUNCEMENT_DEFS 순서상 dance-trampoline(index 0)이 meal-order(index 3)보다 먼저 발화
 */

// 2024-01-17(수) UTC 기준 자정: 1705449600000
const BASE_DATE_UTC = 1705449600000;

function toUtcMs(kstHour: number, kstMinute: number): number {
  const utcHour = kstHour - 9;
  return BASE_DATE_UTC + (utcHour * 3600 + kstMinute * 60) * 1000;
}

function buildDateMockScript(fakeTimestampMs: number): string {
  return `
    (function () {
      var _OrigDate = globalThis.Date;
      var _FAKE_TS = ${fakeTimestampMs};
      class MockDate extends _OrigDate {
        constructor(...args) {
          if (args.length === 0) {
            super(_FAKE_TS);
          } else {
            super(...args);
          }
        }
        static now() { return _FAKE_TS; }
        static parse(...args) { return _OrigDate.parse(...args); }
        static UTC(...args) { return _OrigDate.UTC(...args); }
      }
      globalThis.Date = MockDate;
    })();
  `;
}

function buildScheduleMockScript(schedules: Record<string, object>): string {
  const serialized = JSON.stringify(JSON.stringify(schedules));
  return `localStorage.setItem("annc-schedules", ${serialized});`;
}

/** play()를 항상 resolve로 mock (autoplay 정책 우회 + onerror 방지) */
const PLAY_MOCK_SCRIPT = `
  HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
`;

test.describe("자동 재생 큐 – 동시 발화 중복 문제", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(PLAY_MOCK_SCRIPT);

    await page.route("**/*.mp3", async (route) => {
      // 최소한의 무음 WAV 헤더 (0초 길이)
      const buf = Buffer.alloc(44);
      buf.write("RIFF", 0);
      buf.writeUInt32LE(36, 4);
      buf.write("WAVE", 8);
      buf.write("fmt ", 12);
      buf.writeUInt32LE(16, 16);
      buf.writeUInt16LE(1, 20);
      buf.writeUInt16LE(1, 22);
      buf.writeUInt32LE(8000, 24);
      buf.writeUInt32LE(8000, 28);
      buf.writeUInt16LE(1, 32);
      buf.writeUInt16LE(8, 34);
      buf.write("data", 36);
      buf.writeUInt32LE(0, 40);
      await route.fulfill({ status: 200, contentType: "audio/wav", body: buf });
    });
  });

  /**
   * Bug 1 회귀 테스트
   *
   * 18:00에 dance-trampoline(interval, priority 1)이 먼저 발화하고
   * meal-order(once, priority 0)가 뒤따를 때,
   * dance-trampoline이 끝나기 전까지 meal-order가 재생을 가로채지 않아야 한다.
   *
   * 수정 전: play(dance-trampoline) → play(meal-order) → cleanupAudio()로 첫 번째 중단
   * 수정 후: enqueue를 사용하므로 dance-trampoline이 계속 재생 중
   */
  test("[Bug 1] 동시 발화 시 먼저 발화한 방송이 두 번째에 의해 중단되지 않는다", async ({ page }) => {
    await page.addInitScript(
      buildScheduleMockScript({
        "dance-trampoline": { type: "interval", time: "00:00", intervalMinutes: 30, enabled: true },
        "meal-order": { type: "once", time: "18:00", intervalMinutes: 30, enabled: true },
      })
    );
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 0)));

    await page.goto("/");

    // dance-trampoline(먼저 발화)이 재생 중이어야 한다
    const danceCard = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("댄스트램폴린"),
    });
    await expect(danceCard.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });

    // meal-order는 큐 대기 중이므로 아직 재생 상태가 아니어야 한다
    const mealCard = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("식사주문 마감"),
    });
    await expect(mealCard.getByRole("button", { name: "■ 정지" })).not.toBeVisible();
  });

  /**
   * Bug 2 회귀 테스트
   *
   * 수정 전: 두 번째 play()가 audio.pause()를 호출 → audio.play() Promise가 AbortError로 reject
   *          → .catch()에서 set({ playingId: null }) → UI의 ■ 정지 버튼 소멸
   * 수정 후: enqueue는 현재 재생 오디오를 건드리지 않으므로 AbortError 없음
   */
  test("[Bug 2] 동시 발화 후 재생 UI 상태가 null로 초기화되지 않는다", async ({ page }) => {
    await page.addInitScript(
      buildScheduleMockScript({
        "dance-trampoline": { type: "interval", time: "00:00", intervalMinutes: 30, enabled: true },
        "meal-order": { type: "once", time: "18:00", intervalMinutes: 30, enabled: true },
      })
    );
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 0)));

    await page.goto("/");

    // 두 방송 발화 후 어떤 방송이든 ■ 정지 버튼이 표시되어야 한다 (playingId !== null)
    await expect(page.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });

    // 짧은 시간 후에도 ■ 정지 버튼이 유지되어야 한다 (null로 재초기화되지 않음)
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "■ 정지" })).toBeVisible();
  });

  /**
   * 큐 동시성 테스트
   *
   * 세 방송이 18:00에 동시 발화할 때 정확히 한 방송만 재생 상태여야 하고
   * 나머지 둘은 큐에서 대기해야 한다.
   */
  test("세 방송이 동시에 발화해도 한 번에 한 방송만 재생 상태이다", async ({ page }) => {
    await page.addInitScript(
      buildScheduleMockScript({
        "dance-trampoline": { type: "interval", time: "00:00", intervalMinutes: 30, enabled: true },
        "meal-order": { type: "once", time: "18:00", intervalMinutes: 30, enabled: true },
        "cafe-order": { type: "once", time: "18:00", intervalMinutes: 30, enabled: true },
      })
    );
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 0)));

    await page.goto("/");

    // ■ 정지 버튼이 정확히 1개만 표시되어야 한다
    await expect(page.getByRole("button", { name: "■ 정지" })).toHaveCount(1, {
      timeout: 5000,
    });
  });

  /**
   * 단독 발화 회귀 테스트
   *
   * play() → enqueue() 변경 후에도 단독 발화 시 정상 재생되는지 확인.
   */
  test("단독 발화 시 enqueue가 즉시 재생을 시작한다", async ({ page }) => {
    await page.addInitScript(
      buildScheduleMockScript({
        "zip-line": { type: "interval", time: "00:00", intervalMinutes: 30, enabled: true },
      })
    );
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 0)));

    await page.goto("/");

    const card = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("짚라인"),
    });
    await expect(card.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });
  });
});

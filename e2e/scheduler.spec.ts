import { test, expect } from "@playwright/test";

/**
 * 자동 재생 스케줄러 E2E 테스트
 *
 * Date를 고정된 타임스탬프로 mock하여 스케줄러가 지정된 시각에
 * 올바른 안내방송을 자동으로 재생하는지 검증합니다.
 *
 * 모든 시각은 KST(UTC+9) 기준이며, UTC 타임스탬프로 변환하여 사용합니다.
 * 날짜: 2024-01-17 (수요일, 평일)
 *   - 평일 자동 재생 시간대: 13:00 ~ 19:55
 */

// 2024-01-17(수) UTC 기준 자정: 1705449600000
const BASE_DATE_UTC = 1705449600000; // 2024-01-17T00:00:00.000Z

function toUtcMs(kstHour: number, kstMinute: number): number {
  const utcHour = kstHour - 9;
  return BASE_DATE_UTC + (utcHour * 3600 + kstMinute * 60) * 1000;
}

/** Date 생성자를 고정 타임스탬프로 mock하는 initScript 문자열 */
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

/** play()를 항상 resolve로 mock (autoplay 정책 우회 + onerror 방지) */
const PLAY_MOCK_SCRIPT = `
  HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
`;

test.describe("안내방송 자동 재생 스케줄러", () => {
  /**
   * 각 테스트 전에 공통으로 설정합니다:
   * - 안내방송 오디오(.mp3) 요청을 무음 WAV로 대체
   * - play() mock
   */
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(PLAY_MOCK_SCRIPT);

    await page.route("**/*.mp3", async (route) => {
      // 최소한의 무음 WAV 헤더 (데이터 없음, 0초 길이)
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

  test("18:15 특정 시각 설정 시 식사주문 마감 방송이 자동으로 재생된다", async ({
    page,
  }) => {
    // 2024-01-17 18:15:00 KST (ss=0, 평일 자동 재생 시간대 내)
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 15)));

    await page.goto("/");

    // 스케줄러가 발화하여 카드가 재생 상태로 전환될 때까지 대기
    const card = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("식사주문 마감"),
    });
    await expect(card.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("짝수 시각 :59 설정 시 18:59에 댄스트램폴린 방송이 자동으로 재생된다", async ({
    page,
  }) => {
    // 2024-01-17 18:59:00 KST (짝수 시각, ss=0, 평일 자동 재생 시간대 내)
    await page.addInitScript(buildDateMockScript(toUtcMs(18, 59)));

    await page.goto("/");

    const card = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("댄스트램폴린"),
    });
    await expect(card.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("홀수 시각 :59 설정 시 17:59에 짚라인 방송이 자동으로 재생된다", async ({
    page,
  }) => {
    // 2024-01-17 17:59:00 KST (홀수 시각, ss=0, 평일 자동 재생 시간대 내)
    await page.addInitScript(buildDateMockScript(toUtcMs(17, 59)));

    await page.goto("/");

    const card = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("짚라인"),
    });
    await expect(card.getByRole("button", { name: "■ 정지" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("자동 재생 시간대 밖(12:00)에는 방송이 자동 재생되지 않는다", async ({
    page,
  }) => {
    // 2024-01-17 12:00:00 KST → 평일 자동 재생 시간대(13:00~19:55) 밖
    await page.addInitScript(buildDateMockScript(toUtcMs(12, 0)));

    await page.goto("/");

    // 어떤 카드도 자동 재생되어서는 안 된다
    await page.waitForTimeout(1000);
    await expect(page.getByRole("button", { name: "■ 정지" })).not.toBeVisible();
  });

  test("자동 재생이 꺼진 방송(포토타임)은 해당 시각이 되어도 재생되지 않는다", async ({
    page,
  }) => {
    // 포토타임 기본 스케줄: enabled=false → 어떤 시각에도 재생되면 안 됨
    // 임의의 시각(14:00)으로 설정
    await page.addInitScript(buildDateMockScript(toUtcMs(14, 0)));

    await page.goto("/");

    await page.waitForTimeout(1000);

    // 포토타임 카드는 재생되지 않아야 함
    const card = page.locator("[class*='announcement-card']").filter({
      has: page.getByText("포토타임"),
    });
    await expect(card.getByRole("button", { name: "■ 정지" })).not.toBeVisible();
  });
});

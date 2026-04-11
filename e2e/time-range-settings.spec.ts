import { test, expect } from "@playwright/test";

/**
 * 자동 재생 시간대 설정 모달 E2E 테스트
 *
 * 헤더의 CalendarClock 버튼을 클릭하면 열리는 모달을 대상으로 합니다.
 * - 시간대 제한 on/off 토글
 * - 자동 설정(요일 자동 감지) 토글
 * - 평일/주말 수동 선택
 * - 시작·종료 시각 표시
 * - 취소 / 확인 동작
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/** 시간대 설정 모달 열기 헬퍼 */
async function openModal(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  await page.getByTitle("자동 재생 시간대 설정").click();
  await expect(page.getByText("자동 재생 시간대 설정")).toBeVisible();
}

test.describe("자동 재생 시간대 설정 모달", () => {
  test("헤더 아이콘 버튼 클릭 시 모달이 열린다", async ({ page }) => {
    await openModal(page);
  });

  test("모달에 '시간대 제한 사용' 토글이 있다", async ({ page }) => {
    await openModal(page);
    await expect(page.getByText("시간대 제한 사용")).toBeVisible();
  });

  test("모달에 '자동 설정' 토글이 있다", async ({ page }) => {
    await openModal(page);
    await expect(page.getByText("자동 설정")).toBeVisible();
  });

  test("자동 설정 ON 상태에서 '감지된 요일 유형' 텍스트가 표시된다", async ({ page }) => {
    await openModal(page);
    // 기본값: 자동 설정 ON
    await expect(page.getByText("감지된 요일 유형")).toBeVisible();
  });

  test("자동 설정 ON 상태에서 평일·주말 시간대가 모두 표시된다", async ({ page }) => {
    await openModal(page);
    await expect(page.getByText("평일 시간대")).toBeVisible();
    await expect(page.getByText("주말·공휴일 시간대")).toBeVisible();
  });

  test("기본 평일 시작 시각이 13:00 으로 표시된다", async ({ page }) => {
    await openModal(page);
    // 평일 시간대 행에 13:00 표시
    await expect(page.getByText("13:00")).toBeVisible();
  });

  test("기본 주말 시작 시각이 10:00 으로 표시된다", async ({ page }) => {
    await openModal(page);
    await expect(page.getByText("10:00")).toBeVisible();
  });

  test("× 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await openModal(page);
    await page.getByRole("button", { name: "×" }).click();
    await expect(page.getByText("자동 재생 시간대 설정")).not.toBeVisible();
  });

  test("취소 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await openModal(page);
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("자동 재생 시간대 설정")).not.toBeVisible();
  });

  test("확인 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await openModal(page);
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("자동 재생 시간대 설정")).not.toBeVisible();
  });

  test("오버레이 클릭 시 모달이 닫힌다", async ({ page }) => {
    await openModal(page);
    // 모달 컨테이너 바깥 오버레이 영역을 클릭
    await page.mouse.click(10, 10);
    await expect(page.getByText("자동 재생 시간대 설정")).not.toBeVisible();
  });

  test("'시간대 제한 사용' 토글을 끄면 시간대 섹션이 숨겨진다", async ({ page }) => {
    await openModal(page);
    // SCSS 클래스명은 kebab-case; 텍스트는 label 밖 span에 있으므로 부모 행으로 찾음
    const row = page.locator("[class*='manual-override-row']").filter({ hasText: "시간대 제한 사용" });
    await row.locator("[class*='toggle-switch']").click();
    await expect(page.getByText("평일 시간대")).not.toBeVisible();
    await expect(page.getByText("주말·공휴일 시간대")).not.toBeVisible();
  });

  test("'시간대 제한 사용' 토글을 끄면 '자동 설정' 섹션도 숨겨진다", async ({ page }) => {
    await openModal(page);
    const row = page.locator("[class*='manual-override-row']").filter({ hasText: "시간대 제한 사용" });
    await row.locator("[class*='toggle-switch']").click();
    await expect(page.getByText("자동 설정")).not.toBeVisible();
  });

  test("자동 설정을 끄면 평일/주말 선택 버튼이 나타난다", async ({ page }) => {
    await openModal(page);
    const row = page.locator("[class*='manual-override-row']").filter({ hasText: "자동 설정" });
    await row.locator("[class*='toggle-switch']").click();
    await expect(page.getByRole("button", { name: "평일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "주말·공휴일" })).toBeVisible();
  });

  test("자동 설정을 끄면 '감지된 요일 유형' 텍스트가 사라진다", async ({ page }) => {
    await openModal(page);
    const row = page.locator("[class*='manual-override-row']").filter({ hasText: "자동 설정" });
    await row.locator("[class*='toggle-switch']").click();
    await expect(page.getByText("감지된 요일 유형")).not.toBeVisible();
  });

  test("수동 모드에서 '주말·공휴일' 버튼을 클릭하면 해당 탭이 활성화된다", async ({ page }) => {
    await openModal(page);
    const row = page.locator("[class*='manual-override-row']").filter({ hasText: "자동 설정" });
    await row.locator("[class*='toggle-switch']").click();
    await page.getByRole("button", { name: "주말·공휴일" }).click();
    await expect(page.getByText("주말·공휴일 시간대")).toBeVisible();
  });

  test("시작 시각 박스를 클릭하면 시·분 휠 피커가 나타난다", async ({ page }) => {
    await openModal(page);
    // 평일 시간대의 첫 번째 시작 시각 박스 클릭 (time-block-label의 부모 > time-display-box)
    const startBox = page.getByText("시작").first().locator("xpath=..").locator("[class*='time-display-box']");
    await startBox.click();
    await expect(page.locator("[class*='time-dropdown-wheels']").first()).toBeVisible();
  });
});

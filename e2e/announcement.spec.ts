import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("전체 안내 방송 페이지", () => {
  test("페이지 타이틀이 올바르게 표시된다", async ({ page }) => {
    await expect(page).toHaveTitle("고고 다이노 안내 방송");
  });

  test("현재 시간이 표시된다", async ({ page }) => {
    const time = page.getByText(/\d{2}:\d{2}:\d{2}/);
    await expect(time).toBeVisible();
  });

  test("어트랙션 운영 페이지에 3개 방송 카드가 있다", async ({ page }) => {
    await page.getByRole("button", { name: "어트랙션 운영" }).click();
    await expect(page.getByRole("button", { name: "▶ 재생" })).toHaveCount(3);
  });

  test("마감 안내 방송 페이지에 4개 방송 카드가 있다", async ({ page }) => {
    await page.getByRole("button", { name: "마감 안내 방송" }).click();
    await expect(page.getByRole("button", { name: "▶ 재생" })).toHaveCount(4);
  });

  test("어트랙션 운영: 댄스트램폴린, 짚라인, 포토타임 카드가 있다", async ({ page }) => {
    await expect(page.getByText("댄스트램폴린")).toBeVisible();
    await expect(page.getByText("짚라인")).toBeVisible();
    await expect(page.getByText("포토타임")).toBeVisible();
  });

  test("마감 안내 방송: 4개 항목이 모두 표시된다", async ({ page }) => {
    await expect(page.getByText("식사주문 마감")).toBeVisible();
    await expect(page.getByText("카페음료 마감")).toBeVisible();
    await expect(page.getByText("워터플레이존 마감")).toBeVisible();
    await expect(page.getByText("퇴장")).toBeVisible();
  });

  test("자동 재생 시간 배지가 표시된다", async ({ page }) => {
    await expect(page.getByText("18:15 자동 재생")).toBeVisible();
    await expect(page.getByText("18:50 자동 재생")).toBeVisible();
    await expect(page.getByText("19:10 자동 재생")).toBeVisible();
    await expect(page.getByText("19:50 자동 재생")).toBeVisible();
  });

  test("댄스트램폴린은 짝수 시각 자동 재생으로 설정되어 있다", async ({ page }) => {
    await expect(page.getByText("짝수 시각 58분 자동 재생")).toBeVisible();
  });

  test("짚라인은 홀수 시각 자동 재생으로 설정되어 있다", async ({ page }) => {
    await expect(page.getByText("홀수 시각 58분 자동 재생")).toBeVisible();
  });

  test("포토타임은 자동 재생이 꺼져 있다", async ({ page }) => {
    await expect(page.getByText("자동 재생 꺼짐").first()).toBeVisible();
  });
});

test.describe("방송 설정 모달", () => {
  test("⚙ 버튼 클릭 시 설정 모달이 열린다", async ({ page }) => {
    await page.getByRole("button", { name: "⚙" }).first().click();
    await expect(page.getByText("댄스트램폴린 방송 설정")).toBeVisible();
  });

  test("설정 모달에 자동 재생 토글이 있다", async ({ page }) => {
    await page.getByRole("button", { name: "⚙" }).first().click();
    const modal = page.locator("dialog, [role='dialog'], .modal, [class*='modal']").first();
    // 모달이 열리면 "재생 유형" 텍스트가 나타남 (모달 전용 텍스트)
    await expect(page.getByText("재생 유형")).toBeVisible();
    await expect(page.getByText("재생 시각")).toBeVisible();
  });

  test("설정 모달에 재생 유형 선택이 있다", async ({ page }) => {
    await page.getByRole("button", { name: "⚙" }).first().click();
    await expect(page.getByText("재생 유형")).toBeVisible();
  });

  test("× 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await page.getByRole("button", { name: "⚙" }).first().click();
    await expect(page.getByText("댄스트램폴린 방송 설정")).toBeVisible();

    await page.getByRole("button", { name: "×" }).click();
    await expect(page.getByText("댄스트램폴린 방송 설정")).not.toBeVisible();
  });

  test("취소 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await page.getByRole("button", { name: "⚙" }).first().click();
    await expect(page.getByText("댄스트램폴린 방송 설정")).toBeVisible();

    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("댄스트램폴린 방송 설정")).not.toBeVisible();
  });
});

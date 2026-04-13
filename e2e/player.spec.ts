import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("하단 플레이어", () => {
  test("배경 음악 없음 안내 문구가 표시된다", async ({ page }) => {
    await expect(page.getByText("재생 중인 배경 음악이 없습니다")).toBeVisible();
  });

  test("안내 방송 볼륨 표시값이 100이다", async ({ page }) => {
    const volumeGroup = page.locator("[title='안내 방송 볼륨']");
    await expect(volumeGroup.getByText("100")).toBeVisible();
  });

  test("배경 음악 볼륨 표시값이 70이다", async ({ page }) => {
    const volumeGroup = page.locator("[title='배경 음악 볼륨']");
    await expect(volumeGroup.getByText("70")).toBeVisible();
  });

  test("플레이어 재생 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  });

  test("이전 곡 버튼이 비활성화 상태이다 (배경 음악 없음)", async ({ page }) => {
    await expect(page.getByRole("button", { name: "이전 곡" })).toBeDisabled();
  });

  test("다음 곡 버튼이 비활성화 상태이다 (배경 음악 없음)", async ({ page }) => {
    await expect(page.getByRole("button", { name: "다음 곡" })).toBeDisabled();
  });

  test("자동 재생 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "자동 재생", exact: true })).toBeVisible();
  });

  test("반복 재생 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "반복 재생" })).toBeVisible();
  });

  test("재생 시간이 0:00으로 표시된다", async ({ page }) => {
    await expect(page.getByText("0:00").first()).toBeVisible();
  });
});

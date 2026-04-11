import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "배경 음악", exact: true }).click();
});

test.describe("배경 음악 페이지", () => {
  test("배경 음악 목록 페이지 제목이 표시된다", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("배경 음악 목록");
  });

  test("플레이리스트 패널 제목이 있다", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "플레이리스트" })).toBeVisible();
  });

  test("전체 음악 목록 항목이 있다", async ({ page }) => {
    await expect(page.getByText("전체 음악 목록")).toBeVisible();
  });

  test("새 플레이리스트 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: /새 플레이리스트/ })).toBeVisible();
  });

  test("배경 음악 파일 추가 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "+ 배경 음악 파일 추가" })).toBeVisible();
  });

  test("플레이리스트가 없을 때 안내 메시지가 표시된다", async ({ page }) => {
    await expect(page.getByText("플레이리스트가 없습니다")).toBeVisible();
  });

  test("곡이 없을 때 빈 상태 메시지가 표시된다", async ({ page }) => {
    await expect(page.getByText("등록된 곡이 없습니다.")).toBeVisible();
  });
});

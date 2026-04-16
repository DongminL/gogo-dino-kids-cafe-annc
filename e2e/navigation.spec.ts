import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("사이드바 네비게이션", () => {
  test("로고가 사이드바에 표시된다", async ({ page }) => {
    await expect(page.getByAltText("고고 다이노")).toBeVisible();
  });

  test("안내 방송 메뉴가 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "안내 방송", exact: true })).toBeVisible();
  });

  test("배경 음악 메뉴가 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "배경 음악", exact: true })).toBeVisible();
  });

  test("사용 가이드 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "사용 가이드" })).toBeVisible();
  });

  test("건의하기 버튼이 있다", async ({ page }) => {
    await expect(page.getByRole("button", { name: "건의하기" })).toBeVisible();
  });

  test("어트랙션 운영 클릭 시 해당 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "어트랙션 운영" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "안내 방송 > 어트랙션 운영"
    );
  });

  test("어트랙션 운영 페이지에 3개 카드가 있다", async ({ page }) => {
    await page.getByRole("button", { name: "어트랙션 운영" }).click();
    await expect(page.getByRole("button", { name: "▶ 재생" })).toHaveCount(3);
  });

  test("마감 안내 방송 클릭 시 해당 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "마감 안내 방송" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("마감 안내 방송");
  });

  test("이용 에티켓 방송 클릭 시 해당 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "이용 에티켓 방송" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("이용 에티켓 방송");
  });

  test("배경 음악 클릭 시 배경 음악 목록 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "배경 음악", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("배경 음악 목록");
  });

  test("새 플레이리스트 클릭 시 배경 음악 목록 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "새 플레이리스트" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("배경 음악 목록");
  });
});

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "어트랙션 운영" }).click();
});

test.describe("커스텀 방송 만들기 모달", () => {
  test("+ 방송 만들기 버튼 클릭 시 모달이 열린다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await expect(page.getByText("커스텀 방송 만들기")).toBeVisible();
  });

  test("모달에 제목/카테고리/멘트 입력 필드가 있다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await expect(page.getByPlaceholder("예: 우천 시 안내")).toBeVisible();
    await expect(page.getByPlaceholder("안내 방송으로 읽어줄 멘트를 입력하세요.")).toBeVisible();
  });

  test("멘트 입력 시 글자 수 카운터가 갱신된다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await page.getByPlaceholder("안내 방송으로 읽어줄 멘트를 입력하세요.").fill("안녕하세요");
    await expect(page.getByText("5/1000")).toBeVisible();
  });

  test("× 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await expect(page.getByText("커스텀 방송 만들기")).toBeVisible();
    await page.getByRole("button", { name: "×" }).click();
    await expect(page.getByText("커스텀 방송 만들기")).not.toBeVisible();
  });

  test("취소 버튼 클릭 시 모달이 닫힌다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("커스텀 방송 만들기")).not.toBeVisible();
  });

  test("Electron API가 없는 환경(브라우저)에서는 생성 버튼이 비활성 상태를 유지한다", async ({ page }) => {
    await page.getByRole("button", { name: "+ 방송 만들기" }).click();
    await page.getByPlaceholder("예: 우천 시 안내").fill("우천 안내");
    await page.getByPlaceholder("안내 방송으로 읽어줄 멘트를 입력하세요.").fill("우천 시 안내 방송입니다.");
    await expect(page.getByRole("button", { name: "생성" })).toBeDisabled();
  });
});

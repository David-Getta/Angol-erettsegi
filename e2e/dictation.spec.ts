import { test, expect } from "@playwright/test";

test("dictation: type a sentence, see the word-by-word comparison, go on", async ({ page }) => {
  await page.goto("/hallas");
  await page.getByTestId("dictation-link").click();
  await page.waitForURL(/\/hallas\/diktalas/);
  await page.getByTestId("dictation-input").fill("I think this is");
  await page.getByTestId("dictation-check").click();
  await expect(page.getByTestId("dictation-result")).toContainText("szó helyes");
  await page.getByTestId("dictation-next").click();
  await expect(page.getByTestId("dictation-input")).toHaveValue("");
});

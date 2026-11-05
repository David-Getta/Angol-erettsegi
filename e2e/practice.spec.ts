import { test, expect } from "@playwright/test";

test("language use practice: alternatives, near miss, explanation and the error log", async ({ page }) => {
  await page.goto("/nyelvhelyesseg/lu-emelt-urban-beekeeping-open-cloze");
  await page.getByTestId("gap-10").fill("  THOUGH ");
  await page.getByTestId("gap-10").press("Enter");
  await expect(page.getByTestId("feedback-10")).toContainText("Helyes");
  await page.getByTestId("gap-2").fill("hda");
  await page.getByTestId("gap-2").press("Enter");
  await expect(page.getByTestId("feedback-2")).toContainText("Hibás");
  await expect(page.getByTestId("correct-2")).toHaveText("had");
  await page.getByTestId("finish").click();
  await expect(page.getByTestId("result-summary")).toBeVisible();
  await page.goto("/hibanaplo");
  await expect(page.getByTestId("recent-errors")).toContainText("had");
});

test("reading exam mode: timer, submit at the end, explanations afterwards", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/olvasas/rd-emelt-digital-detox-camps-mc?mode=exam");
  await expect(page.getByTestId("timer")).toBeVisible();
  await page.getByTestId("opt-1-C").click();
  await expect(page.getByTestId("feedback-1")).toHaveCount(0); // no feedback during the exam
  await page.getByTestId("finish").click();
  await expect(page.getByTestId("result-summary")).toBeVisible();
  await expect(page.getByTestId("feedback-1")).toContainText("Helyes");
  await expect(page.getByTestId("feedback-2")).toContainText("Miért rossz a többi");
});

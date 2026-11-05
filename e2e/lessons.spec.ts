import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const lesson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/grammar/kozep/gr-tense.json"), "utf8"));

test("Szabálytár: list → lesson → self-check with the explanation of the correct answer", async ({ page }) => {
  await page.goto("/szabalytar");
  await expect(page.getByTestId("lesson-group-grammar")).toContainText("Igeidők");
  await page.getByTestId("lesson-group-grammar").locator('a[href="/szabalytar/tense"]').click();
  await page.waitForURL(/\/szabalytar\/tense/);
  await expect(page.getByTestId("lesson-rules")).toBeVisible();
  await expect(page.getByTestId("lesson-mistakes")).toBeVisible();

  // answer the first two self-check items: one right, one wrong
  const [first, second] = lesson.practice;
  for (const [item, right] of [
    [first, true],
    [second, false],
  ] as const) {
    const box = page.getByTestId(`lesson-item-${item.id}`);
    if (item.kind === "choice") {
      const key = right ? item.answer : item.options.find((o: { key: string }) => o.key !== item.answer).key;
      await box.locator(`input[value="${key}"]`).check();
    } else {
      await box.locator("input[type=text]").fill(right ? item.answer[0] : "zzz");
    }
    await box.getByRole("button", { name: "Ellenőrzés" }).click();
    await expect(box.getByTestId(`feedback-${item.id}`)).toContainText(right ? "Helyes" : "Hibás");
    await expect(box.getByTestId(`feedback-${item.id}`)).toContainText(item.explanation.slice(0, 30));
  }
  await expect(page.getByTestId("lesson-score")).toContainText("1 / 2");
});

test("an unknown category is a 404", async ({ page }) => {
  const res = await page.goto("/szabalytar/nonexistent-category");
  expect(res?.status()).toBe(404);
});

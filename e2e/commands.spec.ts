import { test, expect } from "@playwright/test";

test("the Commands page lists all four commands with working copy buttons and a builder", async ({ page }) => {
  await page.goto("/parancsok");
  for (const name of ["feladatok", "javitas", "szokincs", "import-hivatalos"]) {
    await expect(page.getByTestId(`command-${name}`)).toBeVisible();
  }
  const copy = page.getByTestId("copy-example-javitas").first();
  await copy.click();
  await expect(copy).toContainText("Másolva");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("/javitas");

  // builder: optional category, skipped topic → "-"
  await page.getByTestId("builder-feladatok-0").selectOption("nyelvhelyesseg");
  await page.getByTestId("builder-feladatok-1").selectOption("emelt");
  await page.getByTestId("builder-feladatok-4").selectOption("tense");
  await expect(page.getByTestId("built-feladatok")).toHaveText("/feladatok nyelvhelyesseg emelt 5 - tense");
  await page.getByTestId("copy-built-feladatok").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("/feladatok nyelvhelyesseg emelt 5 - tense");
});

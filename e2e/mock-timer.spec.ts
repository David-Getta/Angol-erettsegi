import { test, expect } from "@playwright/test";
import { acceptDialogs } from "./helpers";

/** The part countdown must keep running while the student types (it used to jump back on every keystroke). */
test("mock exam countdown only goes down while typing", async ({ page }) => {
  await acceptDialogs(page);
  await page.goto("/kezdolap");
  await page.getByTestId("level-kozep").click();
  await page.goto("/probaerettsegi");
  await page.getByTestId("start-mock").click();
  await page.waitForURL(/\/probaerettsegi\/\d+/);
  for (let part = 1; part <= 3; part++) {
    await page.getByTestId("start-part").click();
    await page.getByTestId("close-part").click();
    await expect(page.getByTestId("start-part")).toBeVisible();
  }
  await page.getByTestId("start-part").click();
  const editor = page.getByTestId("mock-writing-1");
  await expect(editor).toBeVisible();

  const read = async () => {
    const txt = (await page.getByTestId("timer").first().innerText()).replace(/[^0-9:]/g, "");
    return txt.split(":").map(Number).reduce((acc, x) => acc * 60 + x, 0);
  };
  const samples: number[] = [await read()];
  for (let i = 0; i < 8; i++) {
    await editor.pressSequentially("word ", { delay: 60 });
    samples.push(await read());
  }
  for (let i = 1; i < samples.length; i++) expect(samples[i]!, samples.join(", ")).toBeLessThanOrEqual(samples[i - 1]!);
  expect(samples[0]! - samples[samples.length - 1]!, samples.join(", ")).toBeGreaterThanOrEqual(1);
});

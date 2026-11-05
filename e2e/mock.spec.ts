import { test, expect } from "@playwright/test";
import { acceptDialogs, feedbackFromInbox, inboxIds, SAMPLE_TEXT, writeOutbox } from "./helpers";

/**
 * Full written mock exam (emelt): four strictly timed parts in order, the two
 * writing tasks go to the grading inbox, /javitas output is imported, and the
 * result applies the 12% minimum per part.
 */
test("mock exam: four parts → writing graded via the outbox → points, percentage, 12% minimum, grade", async ({ page }) => {
  await acceptDialogs(page);
  await page.goto("/kezdolap");
  await page.getByTestId("level-emelt").click();

  await page.goto("/probaerettsegi");
  const before = new Set(inboxIds());
  await page.getByTestId("start-mock").click();
  await page.waitForURL(/\/probaerettsegi\/\d+/);

  for (let part = 1; part <= 4; part++) {
    await page.getByTestId("start-part").click();
    await expect(page.getByTestId("close-part")).toBeVisible();
    if (part === 4) {
      await page.getByTestId("mock-writing-1").fill(SAMPLE_TEXT.split("\n\n").slice(0, 2).join("\n\n"));
      await page.getByTestId("mock-writing-2").fill(SAMPLE_TEXT);
    }
    await page.getByTestId("close-part").click();
    if (part < 4) await expect(page.getByTestId("start-part")).toBeVisible();
  }

  // result page: writing waits for grading, /javitas tip with import button
  await expect(page.getByTestId("mock-result")).toBeVisible();
  await expect(page.getByTestId("javitas-tip")).toBeVisible();
  await expect(page.getByTestId("part-scores")).toContainText("Javításra vár");

  const ids = inboxIds().filter((x) => !before.has(x));
  expect(ids).toHaveLength(2);
  for (const id of ids) writeOutbox(id, feedbackFromInbox(id));
  await page.getByTestId("import-feedback").first().click();

  // emelt rubric: every criterion max - 1 → task 1: 3+1+2+2+2 = 10, task 2: 3+4+2+2 = 11 → 21 / 30 exam points
  await expect(page.getByTestId("part-scores")).toContainText("21 / 30");
  await expect(page.getByTestId("javitas-tip")).toHaveCount(0);
  // 21 / 120 written points = 17.5% → 18%
  await expect(page.getByTestId("written-pct")).toContainText("18");
  // empty reading, language use and listening are below 12% → failed whatever the total
  await expect(page.getByTestId("part-scores")).toContainText("min. 4");
  await expect(page.getByTestId("grade")).toContainText("elégtelen");
});

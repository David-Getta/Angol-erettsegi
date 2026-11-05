import { test, expect } from "@playwright/test";

/**
 * Subject chooser: picking another subject switches the whole app (navigation,
 * part pages, exam info, mock exam) to that subject's config; switching back
 * restores the English pages. Runs with the seeded content of every subject.
 */
test.afterEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("subject-angol").click();
  await page.waitForURL(/\/kezdolap/);
});

test("subject chooser: matematika has its own parts, exam info and conditional oral", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("subject-matematika")).toBeVisible();
  await page.getByTestId("subject-matematika").click();
  await page.waitForURL(/\/kezdolap/);
  await page.getByTestId("level-kozep").click();
  await expect(page.getByTestId("app-nav")).toContainText("Középszint");

  // navigation shows the maths parts, not the English ones
  const nav = page.getByTestId("app-nav");
  await expect(nav).toContainText("Rövid feladatok");
  await expect(nav).toContainText("Kidolgozott feladatok");
  await expect(nav).not.toContainText("Nyelvhelyesség");

  for (const route of ["/rovid-feladatok", "/kidolgozott-feladatok", "/szobeli", "/szabalytar", "/szokincs", "/temakorok", "/probaerettsegi", "/utmutatok"]) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  // the old English slug is not a page of this subject
  const res = await page.goto("/nyelvhelyesseg");
  expect(res?.status()).toBe(404);

  await page.goto("/vizsga");
  await expect(page.getByTestId("exam-parts-kozep")).toContainText("II. rész");
  await expect(page.getByTestId("exam-parts-kozep")).toContainText("Feltételes szóbeli");
  await expect(page.getByTestId("exam-parts-kozep")).toContainText("150");
});

test("subject chooser: switching back to angol restores the English pages", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("subject-tortenelem").click();
  await page.waitForURL(/\/kezdolap/);
  await expect(page.getByTestId("app-nav")).toContainText("Esszék");
  // the top bar always has a way back to the subject list
  await page.getByTestId("topbar-subjects").click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.getByTestId("subject-angol").click();
  await page.waitForURL(/\/kezdolap/);
  await expect(page.getByTestId("app-nav")).toContainText("Nyelvhelyesség");
  const res = await page.goto("/nyelvhelyesseg");
  expect(res?.status()).toBe(200);
});

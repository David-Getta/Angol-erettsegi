import { test, expect } from "@playwright/test";
import { acceptDialogs, feedbackFromInbox, inboxIds, SAMPLE_TEXT, writeOutbox } from "./helpers";

const TASK = "wr-emelt-gap-year-forum";

test("writing: submit → /javitas tip → outbox import → feedback → rewrite → paste path → error log", async ({ page }) => {
  await acceptDialogs(page);
  await page.goto("/");
  await page.getByTestId("level-emelt").click();

  await page.goto(`/iras/${TASK}`);
  await page.getByTestId("writing-editor").fill(SAMPLE_TEXT);
  await expect(page.getByTestId("word-count")).toContainText("szó");
  const before = new Set(inboxIds());
  await page.getByTestId("submit-writing").click();
  await page.waitForURL(/\/iras\/beadas\//);

  // the /javitas tip appears with a copy button
  const tip = page.getByTestId("javitas-tip");
  await expect(tip).toBeVisible();
  await expect(tip.getByTestId("command-tip-command")).toHaveText("/javitas");
  await tip.getByTestId("command-tip-copy").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("/javitas");

  // the submission is in the inbox; /javitas writes the outbox file
  const id = inboxIds().find((x) => !before.has(x))!;
  expect(id).toBeTruthy();
  writeOutbox(id, feedbackFromInbox(id));
  await page.getByTestId("import-feedback").first().click();
  await expect(page.getByTestId("feedback-view")).toBeVisible();
  await expect(page.getByTestId("feedback-total")).toBeVisible();
  await expect(page.getByTestId("priorities")).toContainText("Igeidők");
  await expect(page.getByTestId("javitas-tip")).toHaveCount(0);

  // rewrite round
  await page.getByTestId("rewrite").click();
  await page.waitForURL(/parent=/);
  await expect(page.getByTestId("writing-editor")).toHaveValue(SAMPLE_TEXT);
  await page.getByTestId("writing-editor").fill(SAMPLE_TEXT.replace("many advantages", "a number of clear advantages"));
  await page.getByTestId("submit-writing").click();
  await page.waitForURL(/\/iras\/beadas\//);
  const v2 = inboxIds().find((x) => x !== id && !before.has(x))!;

  // paste path (Claude app): copy the prompt, paste the JSON answer
  await page.getByTestId("copy-prompt").click();
  await expect(page.getByTestId("copy-prompt")).toContainText("Másolva");
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain("ÁTÍRT VÁLTOZAT");
  await page.getByTestId("paste-feedback").fill("Itt a javítás:\n```json\n" + JSON.stringify(feedbackFromInbox(v2, "claude-app")) + "\n```");
  await page.getByTestId("paste-save").click();
  await expect(page.getByTestId("feedback-view")).toBeVisible();
  await expect(page.getByText("Változatok összehasonlítása")).toBeVisible();

  // a correction goes into the FSRS review as a "fix" card
  await page.getByTestId("add-fix-card").first().click();
  await expect(page.getByText("Bekerült az ismétlésbe").first()).toBeVisible();

  // the error log has the corrections
  await page.goto("/hibanaplo");
  await expect(page.getByTestId("recent-errors")).toContainText("Teszt: a helyes forma és az oka.");

  // the model answer is visible once the task has a submission
  await page.goto(`/iras/${TASK}`);
  await expect(page.getByTestId("model-answer")).toBeVisible();
});

test("writing: invalid pasted JSON shows what is missing", async ({ page }) => {
  await acceptDialogs(page);
  await page.goto(`/iras/${TASK}`);
  await page.getByTestId("writing-editor").fill(SAMPLE_TEXT);
  await page.getByTestId("submit-writing").click();
  await page.waitForURL(/\/iras\/beadas\//);
  await page.getByTestId("paste-feedback").fill('{"schemaVersion": 1, "kind": "writing"}');
  await page.getByTestId("paste-save").click();
  await expect(page.getByTestId("paste-errors")).toContainText("hiányzik");
});

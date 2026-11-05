import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { getDb } from "@/lib/db/client";
import { itemAttempts } from "@/lib/db/schema";
import { pickMistakes } from "@/lib/targeted";
import { getLesson, lessonOverview } from "@/lib/lessons";
import { examConfig } from "@/lib/exam/config";

const TASK = "lu-emelt-urban-beekeeping-open-cloze";

function attempt(itemId: string, correct: boolean, hoursAgo: number) {
  getDb()
    .insert(itemAttempts)
    .values({ taskId: TASK, itemId, category: "tense", section: "language-use", correct, answer: "x", mode: "practice", createdAt: new Date(Date.now() - hoursAgo * 3600e3) })
    .run();
}

describe("mistake review", () => {
  beforeAll(() => {
    seedContent();
  });

  it("re-asks only items whose last attempt was wrong and old enough", () => {
    attempt("1", false, 48); // wrong two days ago → due
    attempt("2", false, 1); // wrong an hour ago → later
    attempt("3", false, 72);
    attempt("3", true, 30); // corrected since → not in the list
    const { due, later } = pickMistakes("emelt", 10, 20);
    const keys = due.map((d) => d.key);
    expect(keys).toContain(`${TASK}:1`);
    expect(keys).not.toContain(`${TASK}:2`);
    expect(keys).not.toContain(`${TASK}:3`);
    expect(later).toBeGreaterThanOrEqual(1);
    // every due item carries its context sentence for the runner
    expect(due.every((d) => d.context.length > 0)).toBe(true);
  });

  it("lists every error category in the Szabálytár overview", () => {
    const overview = lessonOverview();
    expect(overview).toHaveLength(examConfig.errorCategories().categories.length);
    for (const o of overview) {
      if (o.lesson) expect(getLesson(o.category.id)?.category).toBe(o.category.id);
    }
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { getDb } from "@/lib/db/client";
import { itemAttempts } from "@/lib/db/schema";
import { fixedMistakes, pickMistakes } from "@/lib/targeted";
import { getLesson, lessonOverview } from "@/lib/lessons";
import { examConfig } from "@/lib/exam/config";
import { addFixCard, reviewQueue } from "@/lib/vocab/cards";
import { errorsPerWeek } from "@/lib/stats";
import { errors } from "@/lib/db/schema";

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
    // item 3: wrong, then right → one fixed mistake (30 hours ago, so within 30 days but not within 1 day)
    expect(fixedMistakes()).toBe(1);
    expect(fixedMistakes(30)).toBe(1);
    expect(fixedMistakes(1)).toBe(0);
  });

  it("lists every error category in the Szabálytár overview", () => {
    const overview = lessonOverview();
    expect(overview).toHaveLength(examConfig.errorCategories().categories.length);
    for (const o of overview) {
      if (o.lesson) expect(getLesson(o.category.id)?.category).toBe(o.category.id);
    }
  });
});

describe("fix cards from corrections", () => {
  it("adds a correction once and schedules it for review", () => {
    const input = {
      original: "I live here since 2020",
      corrected: "I have lived here since 2020",
      explanation: "A since + múltbeli kezdőpont mellett Present Perfect kell, mert a helyzet ma is tart.",
      context: "I live here since 2020 and I love it.",
      sourceType: "grading",
      sourceId: "w-test",
    };
    expect(addFixCard(input).created).toBe(1);
    expect(addFixCard(input).created).toBe(0);
    const card = reviewQueue().find((c) => c.type === "fix");
    expect(card?.front).toBe("I have lived here since 2020");
    expect(card?.example).toBe("I live here since 2020");
    expect(card?.context).toContain("I love it");
  });
});

describe("errors per week", () => {
  it("counts this week's errors in the last bucket", () => {
    const before = errorsPerWeek(4);
    expect(before).toHaveLength(4);
    getDb()
      .insert(errors)
      .values({ category: "tense", original: "a", corrected: "b", explanation: "c", context: null, sourceType: "writing", sourceId: "x", taskId: null, itemId: null, createdAt: new Date() })
      .run();
    const after = errorsPerWeek(4);
    expect(after[3]!.y).toBe(before[3]!.y + 1);
  });
});

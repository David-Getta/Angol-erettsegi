import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Synthetic content bank: exactly one középszint diagnostic set.
const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "diag-content-"));
process.env.APP_CONTENT_DIR = contentDir;

const real = (p: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "angol", p), "utf8"));
function put(section: string, obj: Record<string, unknown>) {
  const dir = path.join(contentDir, "angol", section, "kozep");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${obj.id}.json`), JSON.stringify(obj));
}

beforeAll(() => {
  put("reading", real("reading/kozep/rd-kozep-repair-cafe-true-false.json"));
  put("language-use", real("language-use/kozep/lu-kozep-digital-grandchildren-verb-forms.json"));
  put("listening", real("listening/kozep/ls-kozep-city-bike-scheme-tf.json"));
  put("writing", real("writing/kozep/wr-kozep-grandma-birthday-email.json"));
});

describe("diagnostic: leaving a part out of the result", () => {
  it("drops an unusable listening part from the estimate, statistics and error log, and can count it again", async () => {
    const { seedContent } = await import("@/lib/content/seed");
    const { startMock, getMock, submitPart, refreshMockResult, setPartExcluded, mockWeakCategories, listMocks } = await import("@/lib/mock");
    const { estimateParts } = await import("@/lib/dashboard");
    const { usedTaskIds, getObjective } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db/client");
    const { errors } = await import("@/lib/db/schema");
    const { and, eq } = await import("drizzle-orm");

    seedContent();
    const started = startMock("diagnostic", "kozep");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const id = started.id;
    const plan = getMock(id)!.plan as { parts: { part: string; taskIds: string[] }[] };
    expect(plan.parts.map((p) => p.part)).toEqual(["reading", "language-use", "listening", "writing"]);

    // reading and language use: all correct; listening: nothing understood (unusable audio)
    const all = (taskId: string, right: boolean) =>
      Object.fromEntries(getObjective(taskId)!.items.map((it) => [it.id, right ? (it.kind === "text" ? it.answer[0]! : it.answer) : ""]));
    plan.parts.forEach((p, i) => {
      const answers = Object.fromEntries(p.taskIds.map((tid) => [tid, p.part === "writing" ? {} : all(tid, p.part !== "listening")]));
      submitPart(id, i, answers, {}, 60);
    });

    const listeningTask = plan.parts.find((p) => p.part === "listening")!.taskIds[0]!;
    const listeningErrors = () => getDb().select().from(errors).where(and(eq(errors.subject, "angol"), eq(errors.sourceType, "listening"))).all().length;
    const before = refreshMockResult(id)!;
    const lsBefore = before.parts.find((p) => p.part === "listening")!;
    expect(lsBefore.pct).toBe(0);
    expect(before.weaknesses).toContain(lsBefore.name);
    expect(estimateParts("kozep", 0).find((e) => e.part === "listening")!.samples).toBe(1);
    expect(usedTaskIds().has(listeningTask)).toBe(true);
    expect(listeningErrors()).toBeGreaterThan(0);
    expect(mockWeakCategories(id).length).toBeGreaterThan(0);

    // leave the listening part out
    const after = setPartExcluded(id, "listening", true)!;
    const lsAfter = after.parts.find((p) => p.part === "listening")!;
    expect(lsAfter.excluded).toBe(true);
    expect(lsAfter.pct).toBeNull();
    expect(after.weaknesses ?? []).not.toContain(lsAfter.name);
    expect(after.strengths ?? []).not.toContain(lsAfter.name);
    expect(after.cefr).toBeTruthy();
    expect(estimateParts("kozep", 0).find((e) => e.part === "listening")!.samples).toBe(0);
    expect(usedTaskIds().has(listeningTask)).toBe(false); // the task can come again
    expect(listeningErrors()).toBe(0);
    expect(mockWeakCategories(id)).toEqual([]);
    expect((getMock(id)!.plan as { excluded?: string[] }).excluded).toEqual(["listening"]);
    expect((listMocks("diagnostic", "kozep")[0]!.result as { parts: { excluded?: boolean }[] }).parts.some((p) => p.excluded)).toBe(true);

    // and count it again
    const back = setPartExcluded(id, "listening", false)!;
    expect(back.parts.find((p) => p.part === "listening")!.excluded).toBeUndefined();
    expect(back.parts.find((p) => p.part === "listening")!.pct).toBe(0);
    expect(estimateParts("kozep", 0).find((e) => e.part === "listening")!.samples).toBe(1);
    expect(listeningErrors()).toBeGreaterThan(0);
  });
});

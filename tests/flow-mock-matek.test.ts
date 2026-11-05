import { beforeAll, describe, expect, it } from "vitest";

/**
 * A non-language subject end to end on the real content bank: the maths
 * középszint mock has the subject's own parts (rövid feladatok + kidolgozott
 * feladatok, one card per rubric task) and a conditional oral – from 25% the
 * written result is final, between 12% and 25% the oral estimate is added.
 */
describe("matematika mock exam", () => {
  beforeAll(async () => {
    const { updateSettings } = await import("@/lib/settings");
    const { seedContent } = await import("@/lib/content/seed");
    updateSettings({ subject: "matematika" });
    updateSettings({ level: "kozep" });
    seedContent();
  });

  async function runMock(readingMode: "all" | "none", writingShare: number) {
    const { startMock, getMock, startPart, submitPart, refreshMockResult } = await import("@/lib/mock");
    const { applyPastedFeedback, rubricRefFor, listSubmissions } = await import("@/lib/submissions");
    const { getObjective } = await import("@/lib/tasks");
    const started = startMock("mock", "kozep");
    expect(started.ok, JSON.stringify(started)).toBe(true);
    if (!started.ok) throw new Error("no set");
    const id = started.id;
    const plan = getMock(id)!.plan as { parts: { part: string; taskIds: string[] }[] };
    expect(plan.parts.map((p) => p.part)).toEqual(["reading", "writing"]);
    expect(plan.parts[1]!.taskIds).toHaveLength(2);

    startPart(id);
    const answers = Object.fromEntries(
      plan.parts[0]!.taskIds.map((tid) => {
        const t = getObjective(tid)!;
        return [tid, Object.fromEntries(t.items.map((it) => [it.id, readingMode === "all" ? (it.kind === "text" ? it.answer[0]! : it.answer) : ""]))];
      }),
    );
    submitPart(id, 0, answers, {}, 600);
    startPart(id);
    submitPart(id, 1, {}, Object.fromEntries(plan.parts[1]!.taskIds.map((tid) => [tid, "a) 120° b) 120 c) 26 300 Ft d) 0,345"])), 600);

    for (const s of listSubmissions("writing").filter((x) => x.mockExamId === id)) {
      const task = getObjective(s.taskId) as unknown as { taskNumber: number } | null;
      const ref = rubricRefFor("writing", "kozep", { taskNumber: task?.taskNumber ?? 1 });
      const criteria = ref.criteria.map((c) => ({ id: c.id, score: Math.floor(c.max * writingShare), max: c.max, justification: "x" }));
      const fb = {
        schemaVersion: 1, submissionId: s.id, kind: "writing", rubricId: ref.id, criteria,
        totalScore: criteria.reduce((n, c) => n + c.score, 0), maxScore: criteria.reduce((n, c) => n + c.max, 0),
        priorities: ["a", "b", "c"], improvedVersion: "x", summary: "x",
      };
      const r = applyPastedFeedback(s.id, JSON.stringify(fb));
      expect(r.ok, JSON.stringify(r)).toBe(true);
    }
    return refreshMockResult(id)!;
  }

  it("above 25% the written result is final (no oral)", async () => {
    const r = await runMock("all", 1);
    expect(r.complete).toBe(true);
    expect(r.writtenMax).toBe(100);
    expect(r.oralSkipped).toBe(true);
    expect(r.outcome.maxPoints).toBe(100);
    expect(r.outcome.pct).toBe(r.writtenPct);
    expect(r.outcome.grade.grade).toBe(5);
    expect(r.outcome.written?.belowMinimum).toBe(false);
  });

  it("between 12% and 25% the oral is added and the total is out of 150", async () => {
    const r = await runMock("none", 0.4);
    expect(r.complete).toBe(true);
    expect(r.writtenPct).toBeGreaterThanOrEqual(12);
    expect(r.writtenPct).toBeLessThan(25);
    expect(r.oralSkipped).toBe(false);
    expect(r.oralEstimate).not.toBeNull();
    expect(r.outcome.maxPoints).toBe(150);
    expect(r.outcome.points).toBe(r.writtenPoints + r.oralEstimate!.points);
  });
});

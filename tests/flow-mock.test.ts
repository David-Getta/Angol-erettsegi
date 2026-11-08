import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Synthetic content bank in a temp dir: enough for one full emelt set.
const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-content-"));
process.env.APP_CONTENT_DIR = contentDir;

const real = (p: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "angol", p), "utf8"));
function put(section: string, level: string, obj: Record<string, unknown>) {
  const dir = path.join(contentDir, "angol", section, level);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${obj.id}.json`), JSON.stringify(obj));
}

beforeAll(() => {
  const rd = real("reading/emelt/rd-emelt-digital-detox-camps-mc.json");
  const lu = real("language-use/emelt/lu-emelt-urban-beekeeping-open-cloze.json");
  const ls = { ...real("listening/kozep/ls-kozep-city-bike-scheme-tf.json"), level: "emelt" };
  const wr2 = real("writing/emelt/wr-emelt-gap-year-forum.json");
  for (let i = 1; i <= 4; i++) put("reading", "emelt", { ...rd, id: `rd-emelt-copy-${i}`, passage: { ...rd.passage, title: `Copy ${i}` } });
  for (let i = 1; i <= 4; i++) put("language-use", "emelt", { ...lu, id: `lu-emelt-copy-${i}` });
  for (let i = 1; i <= 3; i++) put("listening", "emelt", { ...ls, id: `ls-emelt-copy-${i}` });
  put("writing", "emelt", { ...wr2, id: "wr-emelt-copy-t2" });
  put("writing", "emelt", { ...wr2, id: "wr-emelt-copy-t1", taskNumber: 1, points: wr2.points.slice(0, 3), wordLimit: { min: 120, max: 150 } });
});

describe("mock exam flow", () => {
  it("runs a full written mock and computes parts, percentage, minimum check and grade", async () => {
    const { seedContent } = await import("@/lib/content/seed");
    const { startMock, getMock, startPart, submitPart, refreshMockResult, secondsLeft, availableSets, mockWeakCategories } = await import("@/lib/mock");
    const { applyPastedFeedback, rubricRefFor, listSubmissions } = await import("@/lib/submissions");
    const { examConfig, levelStructure } = await import("@/lib/exam/config");
    const { getObjective } = await import("@/lib/tasks");
    const { convertToExamPoints } = await import("@/lib/scoring/exam");
    const { writingPartPoints } = await import("@/lib/scoring/writing");

    seedContent();
    expect(availableSets("emelt")).toBe(1);
    const started = startMock("mock", "emelt");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const id = started.id;
    const plan = getMock(id)!.plan as { parts: { part: string; taskIds: string[]; timeSec: number }[] };
    const st = levelStructure("emelt");
    expect(plan.parts.map((p) => p.part)).toEqual(["reading", "language-use", "listening", "writing"]);
    expect(plan.parts[0]!.timeSec).toBe(st.parts.find((p) => p.id === "reading")!.timeMin! * 60);

    // reading: all correct; language use: nothing answered; listening: half
    const answersFor = (taskId: string, mode: "all" | "none" | "half") => {
      const t = getObjective(taskId)!;
      return Object.fromEntries(
        t.items.map((it, i) => {
          const right = it.kind === "text" ? it.answer[0]! : it.answer;
          if (mode === "none") return [it.id, ""];
          if (mode === "half" && i % 2 === 1) return [it.id, it.kind === "tf" ? (right === "T" ? "F" : "T") : "x"];
          return [it.id, right];
        }),
      );
    };
    startPart(id);
    expect(secondsLeft(getMock(id)!)).toBeGreaterThan(0);
    submitPart(id, 0, Object.fromEntries(plan.parts[0]!.taskIds.map((tid) => [tid, answersFor(tid, "all")])), {}, 600);
    // closing the same part again is ignored (no way back)
    submitPart(id, 0, {}, {}, 1);
    expect(getMock(id)!.currentPart).toBe(1);
    startPart(id);
    submitPart(id, 1, Object.fromEntries(plan.parts[1]!.taskIds.map((tid) => [tid, answersFor(tid, "none")])), {}, 600);
    startPart(id);
    submitPart(id, 2, Object.fromEntries(plan.parts[2]!.taskIds.map((tid) => [tid, answersFor(tid, "half")])), {}, 600);
    startPart(id);
    const text = "Dear Sir or Madam, I am writing to share my opinion about gap years and why they matter for students today.";
    submitPart(id, 3, {}, Object.fromEntries(plan.parts[3]!.taskIds.map((tid) => [tid, text])), 600);

    let m = getMock(id)!;
    expect(m.status).toBe("awaiting-writing");
    let r = refreshMockResult(id)!;
    const reading = r.parts.find((p) => p.part === "reading")!;
    expect(reading.points).toBe(30);
    const lu = r.parts.find((p) => p.part === "language-use")!;
    expect(lu.points).toBe(0);
    const ls = r.parts.find((p) => p.part === "listening")!;
    expect(ls.points).toBe(convertToExamPoints(ls.raw!, ls.rawMax, 30));
    expect(r.parts.find((p) => p.part === "writing")!.pending).toBe(true);
    expect(r.complete).toBe(false);

    // grade the two writing submissions (paste path)
    const subs = listSubmissions("writing").filter((s) => s.mockExamId === id);
    expect(subs).toHaveLength(2);
    for (const s of subs) {
      const tn = s.taskId.endsWith("t1") ? 1 : 2;
      const ref = rubricRefFor("writing", "emelt", { taskNumber: tn });
      const criteria = ref.criteria.map((c) => ({ id: c.id, score: Math.floor(c.max / 2), max: c.max, justification: "x" }));
      const fb = {
        schemaVersion: 1, submissionId: s.id, kind: "writing", rubricId: ref.id, criteria,
        totalScore: criteria.reduce((n, c) => n + c.score, 0), maxScore: criteria.reduce((n, c) => n + c.max, 0),
        priorities: ["a", "b", "c"], improvedVersion: "x", summary: "x",
      };
      expect(applyPastedFeedback(s.id, JSON.stringify(fb)).ok).toBe(true);
    }
    r = refreshMockResult(id)!;
    m = getMock(id)!;
    expect(m.status).toBe("done");
    const rubric = examConfig.writingRubric("emelt");
    const wScores = subs.map((s) => {
      const tn = s.taskId.endsWith("t1") ? 1 : 2;
      return { taskNumber: tn, score: rubricRefFor("writing", "emelt", { taskNumber: tn }).criteria.reduce((n, c) => n + Math.floor(c.max / 2), 0) };
    });
    expect(r.parts.find((p) => p.part === "writing")!.points).toBe(writingPartPoints(rubric, wScores));

    // language use = 0 → below the 12% minimum → the exam fails regardless of the total
    expect(r.complete).toBe(true);
    const luCheck = r.outcome.parts.find((p) => p.part === "language-use")!;
    expect(luCheck.belowMinimum).toBe(true);
    expect(r.outcome.failedByMinimum).toBe(true);
    expect(r.outcome.grade.grade).toBe(1);
    expect(r.outcome.languageExam).toBeNull();
    // percentages
    const written = r.parts.reduce((n, p) => n + (p.points ?? 0), 0);
    expect(r.writtenPoints).toBe(written);
    expect(r.writtenPct).toBe(Math.round((written / 120) * 100));
    expect(r.outcome.points).toBe(written + r.oralEstimate!.points);
    // the categories that cost the most are listed (empty language use → its categories are wrong)
    const weak = mockWeakCategories(id);
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0]!.wrong).toBeGreaterThan(0);
    expect(weak.every((w, i) => i === 0 || weak[i - 1]!.wrong >= w.wrong)).toBe(true);
    // no unused set remains
    expect(availableSets("emelt")).toBe(0);
  });
});

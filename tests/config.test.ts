import { describe, expect, it } from "vitest";
import { examConfig, examConfigProvenance, levelStructure, WRITTEN_PARTS } from "@/lib/exam/config";
import { speakingRubricRef } from "@/lib/exchange/prompts";
import { rubricRefFor } from "@/lib/submissions";
import { gradeFor } from "@/lib/scoring/exam";
import { writingPartPoints } from "@/lib/scoring/writing";
import { loadAllContent } from "@/lib/content/load";
import type { Level, SpeakingTask } from "@/lib/content/schema";

const LEVELS: Level[] = ["kozep", "emelt"];

describe("official exam config is internally consistent", () => {
  it("written parts + oral add up to the level total, and the written time matches", () => {
    for (const level of LEVELS) {
      const s = levelStructure(level);
      const sum = s.parts.reduce((n, p) => n + p.maxPoints, 0);
      expect(sum).toBe(s.totalPoints);
      const written = s.parts.filter((p) => WRITTEN_PARTS.includes(p.id));
      expect(written.reduce((n, p) => n + (p.timeMin ?? 0), 0)).toBe(s.writtenTotalMin);
    }
  });

  it("writing rubric criteria sum to each task's maxRaw and the tasks to the part maximum", () => {
    for (const level of LEVELS) {
      const r = examConfig.writingRubric(level);
      for (const t of r.tasks) expect(t.criteria.reduce((n, c) => n + c.max, 0)).toBe(t.maxRaw);
      const rawMax = r.tasks.reduce((n, t) => n + t.maxRaw, 0);
      if (r.conversion.method === "identity") expect(rawMax).toBe(r.examMaxPoints);
      expect(r.examMaxPoints).toBe(levelStructure(level).parts.find((p) => p.id === "writing")!.maxPoints);
      // full marks on both tasks = full exam points
      expect(writingPartPoints(r, r.tasks.map((t) => ({ taskNumber: t.taskNumber, score: t.maxRaw })))).toBe(r.examMaxPoints);
    }
  });

  it("every writing card uses its rubric word limit", () => {
    const cards = loadAllContent().items.filter((i) => i.content?.section === "writing");
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const w = c.content!;
      if (w.section !== "writing") continue;
      const rt = examConfig.writingRubric(w.level).tasks.find((t) => t.taskNumber === w.taskNumber)!;
      expect(w.wordLimit, w.id).toEqual(rt.wordLimit);
    }
  });

  it("every speaking task type in the bank has rubric criteria, and the oral total matches the structure", () => {
    const speaking = loadAllContent()
      .items.map((i) => i.content)
      .filter((c): c is SpeakingTask => c?.section === "speaking");
    for (const level of LEVELS) {
      const r = examConfig.speakingRubric(level);
      expect(r.examMaxPoints).toBe(levelStructure(level).parts.find((p) => p.id === "speaking")!.maxPoints);
      for (const task of speaking.filter((s) => s.level === level)) {
        const ref = speakingRubricRef(r, task.type, "angol");
        expect(r.tasks.some((t) => t.types.includes(task.type)), `${level}/${task.type}`).toBe(true);
        expect(ref.taskNumber).toBe(task.partNumber);
      }
      if (r.conversion.method === "identity") {
        const raw = r.tasks.reduce((n, t) => n + t.criteria.reduce((m, c) => m + c.max, 0), 0) + r.overall.reduce((n, c) => n + c.max, 0);
        expect(raw).toBe(r.examMaxPoints);
      }
    }
    expect(rubricRefFor("speaking", "emelt", { type: "debate" }).id).toBe("speaking-emelt-debate");
  });

  it("grade boundaries are descending and both levels pass from 25%", () => {
    const g = examConfig.grading();
    for (const level of LEVELS) {
      const b = g.gradeBoundaries[level];
      for (let i = 1; i < b.length; i++) expect(b[i - 1]!.minPct).toBeGreaterThan(b[i]!.minPct);
      expect(gradeFor(level, 25, g).grade).toBe(2);
      expect(gradeFor(level, 24, g).grade).toBe(1);
    }
  });

  it("every error category has a Szabálytár lesson", () => {
    const lessons = new Set(
      loadAllContent()
        .items.map((i) => i.content)
        .filter((c) => c?.section === "grammar")
        .map((c) => (c as { category: string }).category),
    );
    for (const c of examConfig.errorCategories().categories) expect(lessons.has(c.id), c.id).toBe(true);
  });

  it("every writing text type and speaking task type in the bank, and every exam part, has a guide", () => {
    const content = loadAllContent().items.map((i) => i.content!);
    const guides = new Set(content.filter((c) => c.section === "guide").map((c) => c.id));
    const need = new Set<string>(["reading", "language-use", "listening", "writing", "speaking"].map((p) => `gd-exam-${p}`));
    for (const c of content) {
      if (c.section === "writing") need.add(`gd-writing-${c.type}`);
      if (c.section === "speaking") need.add(`gd-speaking-${c.type}`);
    }
    for (const id of need) expect(guides.has(id), id).toBe(true);
  });

  it("every official config file records when and from where it was verified", () => {
    for (const p of examConfigProvenance()) {
      expect(p.verifiedAt, p.file).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sources.length, p.file).toBeGreaterThan(0);
    }
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configFor, examConfigProvenance, subjects, type PartId } from "@/lib/exam/config";
import { speakingRubricRef } from "@/lib/exchange/prompts";
import { rubricRefFor } from "@/lib/submissions";
import { gradeFor } from "@/lib/scoring/exam";
import { writingPartPoints } from "@/lib/scoring/writing";
import { loadAllContent } from "@/lib/content/load";
import type { Content, Level, SpeakingTask } from "@/lib/content/schema";

const LEVELS: Level[] = ["kozep", "emelt"];
const WRITTEN: string[] = ["reading", "language-use", "listening", "writing"];

/** Every subject that has a config folder is checked with its own config and its own content. */
const configured = subjects().filter((s) => fs.existsSync(path.join(process.cwd(), "config/subjects", s.id, "structure.json")));
const allContent = loadAllContent().items.map((i) => i.content!);

describe("subject registry", () => {
  it("every subject has a config folder", () => {
    for (const s of subjects()) expect(fs.existsSync(path.join(process.cwd(), "config/subjects", s.id, "structure.json")), s.id).toBe(true);
  });
  it("subject ids and exam dates are well formed", () => {
    const ids = subjects().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of subjects()) expect(s.defaultExamDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

for (const subject of configured) {
  const cfg = configFor(subject.id);
  const content: Content[] = allContent.filter((c) => c.subject === subject.id);

  describe(`official exam config of ${subject.id} is internally consistent`, () => {
    it("parts add up to the level total, the written time matches, slugs are unique", () => {
      for (const level of LEVELS) {
        const s = cfg.structure().levels[level];
        const sum = s.parts.reduce((n, p) => n + p.maxPoints, 0);
        expect(sum, `${level} total`).toBe(s.totalPoints);
        const written = s.parts.filter((p) => p.written);
        expect(written.every((p) => WRITTEN.includes(p.id)), `${level}: written parts use written slots`).toBe(true);
        expect(written.reduce((n, p) => n + (p.timeMin ?? 0), 0), `${level} written time`).toBe(s.writtenTotalMin);
        expect(s.parts.filter((p) => p.kind === "oral").length, `${level}: at most one oral part`).toBeLessThanOrEqual(1);
        const slugs = s.parts.map((p) => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        const ids = s.parts.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const p of s.parts) expect(p.kind === "oral" ? !p.written : p.written, `${level}/${p.id}: oral parts are not written`).toBe(true);
      }
    });

    it("the same part slots and slugs are used on both levels", () => {
      const a = cfg.structure().levels.kozep.parts.map((p) => `${p.id}:${p.slug}:${p.kind}`).sort();
      const b = cfg.structure().levels.emelt.parts.map((p) => `${p.id}:${p.slug}:${p.kind}`).sort();
      expect(a).toEqual(b);
    });

    it("writing rubric criteria sum to each task's maxRaw and the tasks to the part maximum", () => {
      for (const level of LEVELS) {
        if (!cfg.hasRubric("writing", level)) continue;
        const r = cfg.writingRubric(level);
        for (const t of r.tasks) expect(t.criteria.reduce((n, c) => n + c.max, 0), `${level}/task ${t.taskNumber}`).toBe(t.maxRaw);
        const rawMax = r.tasks.reduce((n, t) => n + t.maxRaw, 0);
        if (r.conversion.method === "identity") expect(rawMax).toBe(r.examMaxPoints);
        const part = cfg.structure().levels[level].parts.find((p) => p.id === "writing");
        if (part) expect(r.examMaxPoints, `${level} writing part`).toBe(part.maxPoints);
        expect(writingPartPoints(r, r.tasks.map((t) => ({ taskNumber: t.taskNumber, score: t.maxRaw })))).toBe(r.examMaxPoints);
        const types = new Set(cfg.taskTypes().writing.map((t) => t.id));
        for (const t of r.tasks) for (const tt of t.textTypes) expect(types.has(tt), `${level}/task ${t.taskNumber}: ${tt}`).toBe(true);
      }
    });

    it("every written part has a rubric for both levels", () => {
      for (const level of LEVELS) {
        if (cfg.structure().levels[level].parts.some((p) => p.kind === "written")) expect(cfg.hasRubric("writing", level), level).toBe(true);
        if (cfg.structure().levels[level].parts.some((p) => p.kind === "oral")) expect(cfg.hasRubric("speaking", level), level).toBe(true);
      }
    });

    it("every writing card uses its rubric word limit", () => {
      for (const c of content) {
        if (c.section !== "writing") continue;
        const rt = cfg.writingRubric(c.level).tasks.find((t) => t.taskNumber === c.taskNumber);
        expect(rt, `${c.id}: task ${c.taskNumber}`).toBeDefined();
        expect(c.wordLimit, c.id).toEqual(rt!.wordLimit);
      }
    });

    it("every speaking task type in the bank has rubric criteria, and the oral total matches the structure", () => {
      const speaking = content.filter((c): c is SpeakingTask => c.section === "speaking");
      for (const level of LEVELS) {
        if (!cfg.hasRubric("speaking", level)) continue;
        const r = cfg.speakingRubric(level);
        const oral = cfg.structure().levels[level].parts.find((p) => p.kind === "oral");
        if (oral) expect(r.examMaxPoints, `${level} oral`).toBe(oral.maxPoints);
        const types = new Set(cfg.taskTypes().speaking.map((t) => t.id));
        for (const t of r.tasks) for (const tt of t.types) expect(types.has(tt), `${level}: rubric type ${tt}`).toBe(true);
        for (const task of speaking.filter((s) => s.level === level)) {
          const ref = speakingRubricRef(r, task.type, subject.id);
          expect(r.tasks.some((t) => t.types.includes(task.type)), `${level}/${task.type}`).toBe(true);
          expect(ref.taskNumber, task.id).toBe(task.partNumber);
        }
        if (r.conversion.method === "identity") {
          const raw = r.tasks.reduce((n, t) => n + t.criteria.reduce((m, c) => m + c.max, 0), 0) + r.overall.reduce((n, c) => n + c.max, 0);
          expect(raw).toBe(r.examMaxPoints);
        }
      }
    });

    it("grade boundaries are descending and both levels pass from 25%", () => {
      const g = cfg.grading();
      for (const level of LEVELS) {
        const b = g.gradeBoundaries[level];
        for (let i = 1; i < b.length; i++) expect(b[i - 1]!.minPct).toBeGreaterThan(b[i]!.minPct);
        expect(gradeFor(level, 25, g).grade).toBe(2);
        expect(gradeFor(level, 24, g).grade).toBe(1);
      }
      const partIds = new Set<string>(cfg.structure().levels.kozep.parts.map((p) => p.id));
      for (const p of g.minPartAppliesTo) expect(p === "written" || partIds.has(p), `minPartAppliesTo: ${p}`).toBe(true);
    });

    it("error categories belong to a declared group; task types and topics are unique", () => {
      const ec = cfg.errorCategories();
      const groups = new Set(ec.groups.map((g) => g.id));
      for (const c of ec.categories) expect(groups.has(c.group), `${c.id} → ${c.group}`).toBe(true);
      const ids = ec.categories.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const topics = cfg.topics().topics.map((t) => t.id);
      expect(new Set(topics).size).toBe(topics.length);
      const tt = cfg.taskTypes();
      for (const section of ["reading", "language-use", "listening", "writing", "speaking"] as const) {
        const typeIds = tt[section].map((t) => t.id);
        expect(new Set(typeIds).size, section).toBe(typeIds.length);
      }
    });

    it("the part features only ask for what the schema can hold", () => {
      for (const level of LEVELS) {
        for (const p of cfg.structure().levels[level].parts) {
          if (p.features.audio) expect(p.kind, `${p.id}: audio parts are objective`).toBe("objective");
          if (p.features.categoryGroups.length) for (const g of p.features.categoryGroups) expect(cfg.errorCategories().groups.some((x) => x.id === g), `${p.id}: group ${g}`).toBe(true);
        }
      }
    });

    it("every official config file records when and from where it was verified", () => {
      for (const p of examConfigProvenance(subject.id)) {
        expect(p.verifiedAt, p.file).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.sources.length, p.file).toBeGreaterThan(0);
      }
    });

    if (content.length > 0) {
      it("every error category has a Szabálytár lesson", () => {
        const lessons = new Set(content.filter((c) => c.section === "grammar").map((c) => (c as { category: string }).category));
        for (const c of cfg.errorCategories().categories) expect(lessons.has(c.id), c.id).toBe(true);
      });

      it("every writing text type and speaking task type in the bank, and every exam part, has a guide", () => {
        const guides = new Set(content.filter((c) => c.section === "guide").map((c) => c.id));
        const parts = new Set<PartId>([...cfg.structure().levels.kozep.parts, ...cfg.structure().levels.emelt.parts].map((p) => p.id));
        const need = new Set<string>([...parts].map((p) => `gd-exam-${p}`));
        for (const c of content) {
          if (c.section === "writing") need.add(`gd-writing-${c.type}`);
          if (c.section === "speaking") need.add(`gd-speaking-${c.type}`);
        }
        for (const id of need) expect(guides.has(id), id).toBe(true);
      });

      it("every exam part of the subject has at least one task on each level", () => {
        for (const level of LEVELS) {
          for (const p of cfg.structure().levels[level].parts) {
            expect(content.some((c) => c.level === level && c.section === p.id), `${subject.id}/${level}/${p.id}`).toBe(true);
          }
        }
      });
    }
  });
}

describe("English rubric references", () => {
  it("resolves the debate task of the emelt speaking rubric", () => {
    expect(rubricRefFor("speaking", "emelt", { type: "debate" }, "angol").id).toBe("speaking-emelt-debate");
  });
});

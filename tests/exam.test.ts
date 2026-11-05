import { describe, expect, it } from "vitest";
import { checkParts, convertToExamPoints, examOutcome, gradeFor, languageExamFor, minPointsFor, totalPercent, roundHalfUp } from "@/lib/scoring/exam";
import { examConfig, levelStructure } from "@/lib/exam/config";

const grading = examConfig.grading();

describe("conversion", () => {
  it("rounds half up", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.49)).toBe(2);
  });
  it("converts proportionally", () => {
    expect(convertToExamPoints(20, 40, 30)).toBe(15);
    expect(convertToExamPoints(0, 40, 30)).toBe(0);
    expect(convertToExamPoints(50, 40, 30)).toBe(30);
  });
  it("uses a conversion table when the raw maximum matches", () => {
    const conv = { method: "table" as const, rawMax: 10, table: [{ raw: 0, points: 0 }, { raw: 5, points: 4 }, { raw: 10, points: 9 }] };
    expect(convertToExamPoints(7, 10, 9, conv)).toBe(4);
    expect(convertToExamPoints(10, 10, 9, conv)).toBe(9);
    // other raw maximum → proportional
    expect(convertToExamPoints(6, 12, 9, conv)).toBe(5);
  });
});

describe("minimum per part", () => {
  it("computes the smallest whole point reaching the percentage", () => {
    expect(minPointsFor(33, { minPartPercent: 12 })).toBe(4); // 3.96 → 4
    expect(minPointsFor(30, { minPartPercent: 12 })).toBe(4); // 3.6 → 4
    expect(minPointsFor(18, { minPartPercent: 12 })).toBe(3); // 2.16 → 3
  });
  it("flags parts below the minimum and at risk", () => {
    const r = checkParts(
      [
        { part: "reading", points: 3, maxPoints: 30 },
        { part: "listening", points: 4, maxPoints: 30 },
        { part: "writing", points: null, maxPoints: 30 },
      ],
      { minPartPercent: 12, minPartAppliesTo: ["reading", "listening", "writing"] },
    );
    expect(r[0]!.belowMinimum).toBe(true);
    expect(r[1]!.belowMinimum).toBe(false);
    expect(r[1]!.atRisk).toBe(true);
    expect(r[2]!.belowMinimum).toBe(false);
  });
});

describe("grades and percentage", () => {
  it("rounds the percentage", () => {
    expect(totalPercent(89, 150)).toBe(59);
    expect(totalPercent(90, 150)).toBe(60);
  });
  it("finds the grade from the config boundaries", () => {
    for (const level of ["kozep", "emelt"] as const) {
      const bounds = grading.gradeBoundaries[level]!;
      for (const b of bounds) expect(gradeFor(level, b.minPct, grading).grade).toBe(b.grade);
    }
  });
  it("gives the language exam equivalence only where configured", () => {
    for (const e of grading.languageExamEquivalence) {
      expect(languageExamFor(e.level, e.minPct, grading)?.cefr).toBe(e.cefr);
    }
    expect(languageExamFor("emelt", 0, grading)).toBeNull();
  });
  it("a part below the minimum fails the exam regardless of the total", () => {
    const st = levelStructure("emelt");
    const scores = st.parts.map((p) => ({ part: p.id, points: p.id === "language-use" ? 1 : p.maxPoints, maxPoints: p.maxPoints }));
    const r = examOutcome("emelt", scores, st, grading);
    expect(r.failedByMinimum).toBe(true);
    expect(r.grade.grade).toBe(1);
    expect(r.languageExam).toBeNull();
  });
  it("full marks give the best grade", () => {
    const st = levelStructure("kozep");
    const r = examOutcome("kozep", st.parts.map((p) => ({ part: p.id, points: p.maxPoints, maxPoints: p.maxPoints })), st, grading);
    expect(r.pct).toBe(100);
    expect(r.grade.grade).toBe(5);
    expect(r.complete).toBe(true);
  });
});

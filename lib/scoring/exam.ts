import type { Level } from "@/lib/content/schema";
import type { ExamPart, Grading, LevelStructure, PartId } from "@/lib/exam/config";

/**
 * Exam-level arithmetic: raw task points -> exam points (vizsgapont), total
 * percentage, the per-part minimum check, the grade and the language exam
 * equivalence. Pure functions; all numbers come from config/exam/*.json.
 */

type Conversion = ExamPart["conversion"];

/** Round half up (0.5 -> 1), which is how exam points are rounded. */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9);
}

export function convertToExamPoints(raw: number, rawMax: number, examMax: number, conversion?: Conversion): number {
  if (rawMax <= 0) return 0;
  const r = Math.max(0, Math.min(raw, rawMax));
  if (conversion?.method === "identity" && rawMax === examMax) return r;
  if (conversion?.method === "table" && conversion.table && conversion.rawMax === rawMax) {
    const sorted = [...conversion.table].sort((a, b) => a.raw - b.raw);
    let pts = 0;
    for (const row of sorted) if (r >= row.raw) pts = row.points;
    return pts;
  }
  return roundHalfUp((r / rawMax) * examMax);
}

export type PartScore = {
  part: PartId;
  points: number | null; // null = not yet graded / not taken
  maxPoints: number;
};

export type PartCheck = PartScore & {
  pct: number | null;
  minPoints: number;
  belowMinimum: boolean;
  /** Within 3 percentage points above the minimum. */
  atRisk: boolean;
};

export function minPointsFor(maxPoints: number, grading: Pick<Grading, "minPartPercent">): number {
  // "legalább 12%": the smallest whole point value that reaches the percentage
  return Math.ceil((maxPoints * grading.minPartPercent) / 100 - 1e-9);
}

export function checkParts(scores: PartScore[], grading: Pick<Grading, "minPartPercent" | "minPartAppliesTo">): PartCheck[] {
  return scores.map((s) => {
    const applies = (grading.minPartAppliesTo as string[]).includes(s.part);
    const minPoints = applies ? minPointsFor(s.maxPoints, grading) : 0;
    const pct = s.points === null ? null : (s.points / s.maxPoints) * 100;
    const belowMinimum = applies && s.points !== null && s.points < minPoints;
    const atRisk = applies && s.points !== null && !belowMinimum && pct !== null && pct < grading.minPartPercent + 3;
    return { ...s, pct, minPoints, belowMinimum, atRisk };
  });
}

export function totalPercent(points: number, maxPoints: number, rounding: Grading["percentRounding"] = "round"): number {
  if (maxPoints <= 0) return 0;
  const pct = (points / maxPoints) * 100;
  return rounding === "floor" ? Math.floor(pct + 1e-9) : roundHalfUp(pct);
}

export function gradeFor(level: Level, pct: number, grading: Pick<Grading, "gradeBoundaries">) {
  const bounds = [...(grading.gradeBoundaries[level] ?? [])].sort((a, b) => b.minPct - a.minPct);
  for (const b of bounds) if (pct >= b.minPct) return b;
  return bounds[bounds.length - 1] ?? { grade: 1, name: "elégtelen", minPct: 0 };
}

export function languageExamFor(level: Level, pct: number, grading: Pick<Grading, "languageExamEquivalence">) {
  return (
    grading.languageExamEquivalence
      .filter((e) => e.level === level && pct >= e.minPct && (e.maxPct === undefined || pct <= e.maxPct))
      .sort((a, b) => b.minPct - a.minPct)[0] ?? null
  );
}

/** The written parts together as one vizsgarész (subjects where the 12% applies to the whole written exam). */
export type WrittenCheck = { points: number; maxPoints: number; pct: number; minPoints: number; belowMinimum: boolean; complete: boolean };

const WRITTEN: string[] = ["reading", "language-use", "listening", "writing"];

export function checkWritten(scores: PartScore[], grading: Pick<Grading, "minPartPercent" | "minPartAppliesTo">): WrittenCheck | null {
  if (!(grading.minPartAppliesTo as string[]).includes("written")) return null;
  const written = scores.filter((s) => WRITTEN.includes(s.part));
  if (!written.length) return null;
  const maxPoints = written.reduce((n, s) => n + s.maxPoints, 0);
  const points = written.reduce((n, s) => n + (s.points ?? 0), 0);
  const complete = written.every((s) => s.points !== null);
  const minPoints = minPointsFor(maxPoints, grading);
  return { points, maxPoints, pct: maxPoints ? (points / maxPoints) * 100 : 0, minPoints, belowMinimum: complete && points < minPoints, complete };
}

export type ExamOutcome = {
  parts: PartCheck[];
  /** Set when the minimum applies to the written parts together. */
  written: WrittenCheck | null;
  points: number;
  maxPoints: number;
  pct: number;
  complete: boolean;
  passedMinimums: boolean;
  grade: { grade: number; name: string; minPct: number };
  /** Grade if a part is below the minimum: the exam fails regardless of the total. */
  failedByMinimum: boolean;
  languageExam: Grading["languageExamEquivalence"][number] | null;
};

/**
 * Full outcome. Parts with points === null are counted as 0 for the percentage
 * but flagged incomplete (e.g. writing waits for feedback, oral not taken).
 */
export function examOutcome(
  level: Level,
  scores: PartScore[],
  structure: Pick<LevelStructure, "totalPoints">,
  grading: Grading,
): ExamOutcome {
  const parts = checkParts(scores, grading);
  const written = checkWritten(scores, grading);
  const points = parts.reduce((s, p) => s + (p.points ?? 0), 0);
  const maxPoints = structure.totalPoints;
  const pct = totalPercent(points, maxPoints, grading.percentRounding);
  const complete = parts.every((p) => p.points !== null);
  const failedByMinimum = parts.some((p) => p.belowMinimum) || (written?.belowMinimum ?? false);
  const passedMinimums = complete && !failedByMinimum;
  const lowest = [...(grading.gradeBoundaries[level] ?? [])].sort((a, b) => a.minPct - b.minPct)[0] ?? {
    grade: 1,
    name: "elégtelen",
    minPct: 0,
  };
  const grade = failedByMinimum ? lowest : gradeFor(level, pct, grading);
  const languageExam = complete && !failedByMinimum ? languageExamFor(level, pct, grading) : null;
  return { parts, written, points, maxPoints, pct, complete, passedMinimums, grade, failedByMinimum, languageExam };
}

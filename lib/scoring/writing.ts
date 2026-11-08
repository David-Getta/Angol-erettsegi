import type { WritingRubric } from "@/lib/exam/config";
import { convertToExamPoints } from "./exam";

/** Writing part exam points from the task scores (both tasks of the part). */
export function writingPartPoints(rubric: WritingRubric, scores: { taskNumber: number; score: number }[]): number {
  const rawMax = rubric.tasks.reduce((s, t) => s + t.maxRaw, 0);
  const raw = scores.reduce((s, x) => s + x.score, 0);
  return convertToExamPoints(raw, rawMax, rubric.examMaxPoints, rubric.conversion);
}

/** The share of one task in the writing part, in exam points (for display on a single task). */
export function singleTaskExamPoints(rubric: WritingRubric, taskNumber: number, score: number): { points: number; max: number } {
  const rawMax = rubric.tasks.reduce((s, t) => s + t.maxRaw, 0);
  const task = rubric.tasks.find((t) => t.taskNumber === taskNumber);
  if (!task || rawMax === 0) return { points: 0, max: 0 };
  const share = rubric.examMaxPoints * (task.maxRaw / rawMax);
  return { points: Math.round((score / task.maxRaw) * share * 10) / 10, max: Math.round(share * 10) / 10 };
}

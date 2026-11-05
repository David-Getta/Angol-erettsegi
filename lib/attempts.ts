import { desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { attempts, itemAttempts, type AttemptRow } from "@/lib/db/schema";
import type { ObjectiveTask } from "@/lib/content/schema";
import { scoreTask, type TaskResult } from "@/lib/scoring/check";
import { examConfig } from "@/lib/exam/config";
import { logObjectiveErrors } from "@/lib/errors/log";
import { logActivity } from "@/lib/activity";
import { getObjective } from "@/lib/tasks";

export type AttemptMode = "practice" | "exam" | "mock" | "diagnostic";

export function acceptNearMiss(section: string): boolean {
  return (examConfig.app().textAnswers.acceptNearMissIn as string[]).includes(section);
}

export function scoreObjective(task: ObjectiveTask, answers: Record<string, string>): TaskResult {
  return scoreTask(task, answers, { acceptNearMiss: acceptNearMiss(task.section) });
}

/**
 * Scores the answers on the server (the stored score never trusts the
 * client), saves the attempt, logs wrong answers in the error log and the
 * practice time.
 */
export function saveAttempt(input: {
  taskId: string;
  mode: AttemptMode;
  answers: Record<string, string>;
  durationSec: number;
  mockExamId?: number | null;
}): { attempt: AttemptRow; result: TaskResult } {
  const task = getObjective(input.taskId);
  if (!task) throw new Error(`Ismeretlen feladat: ${input.taskId}`);
  const result = scoreObjective(task, input.answers);
  const db = getDb();
  const attempt = db
    .insert(attempts)
    .values({
      taskId: task.id,
      section: task.section,
      level: task.level,
      mode: input.mode,
      answers: input.answers,
      results: result.items,
      score: result.score,
      maxScore: result.maxScore,
      durationSec: Math.max(0, Math.round(input.durationSec)),
      mockExamId: input.mockExamId ?? null,
      createdAt: new Date(),
    })
    .returning()
    .get();
  for (const r of result.items) {
    db.insert(itemAttempts)
      .values({
        taskId: task.id,
        itemId: r.itemId,
        category: r.category,
        section: task.section,
        correct: r.correct,
        answer: r.given,
        mode: input.mode,
        createdAt: new Date(),
      })
      .run();
  }
  logObjectiveErrors(task, result.items, task.section, String(attempt.id));
  logActivity(task.section, input.durationSec);
  return { attempt, result };
}

export function attemptsForTask(taskId: string): AttemptRow[] {
  return getDb().select().from(attempts).where(eq(attempts.taskId, taskId)).orderBy(desc(attempts.createdAt)).all();
}

export function recentAttempts(section: string, level: string, limit = 20): AttemptRow[] {
  return getDb()
    .select()
    .from(attempts)
    .where(and(eq(attempts.section, section), eq(attempts.level, level)))
    .orderBy(desc(attempts.createdAt))
    .limit(limit)
    .all();
}

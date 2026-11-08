import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { errors, tasks } from "@/lib/db/schema";
import { examConfig, type ErrorCategory } from "@/lib/exam/config";
import { checkItem, type ItemResult } from "@/lib/scoring/check";
import { decimalComma } from "@/lib/attempts";
import type { GrammarLesson } from "@/lib/content/schema";
import { getContent } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { contentIdPrefix, currentSubject } from "@/lib/exam/config";

/**
 * Szabálytár: one lesson per error category (content/grammar/kozep/gr-<category>.json).
 * Lessons are read from the seeded tasks table like every other content file.
 */

/** Lesson id of a category in the current subject (angol: gr-tense, matematika: mat-gr-szamolasi-hiba). */
export const lessonId = (category: string, subjectId?: string) => `${contentIdPrefix(subjectId)}gr-${category}`;

export type LessonSummary = {
  category: string;
  name: string;
  group: ErrorCategory["group"];
  title: string;
  summary: string;
  practiceCount: number;
  /** Errors logged in this category (all time / last 30 days). */
  errorsTotal: number;
  errors30: number;
};

/** Categories that have an active lesson. */
export function lessonCategories(): Set<string> {
  const rows = getDb()
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.section, "grammar"), eq(tasks.active, true)))
    .all();
  const prefix = `${contentIdPrefix()}gr-`;
  return new Set(rows.filter((r) => r.id.startsWith(prefix)).map((r) => r.id.slice(prefix.length)));
}

export function getLesson(category: string): GrammarLesson | null {
  const c = getContent<GrammarLesson>(lessonId(category));
  return c && c.section === "grammar" ? c : null;
}

/** Every error category with its lesson (if any) and how often the student made that error. */
export function lessonOverview(): { category: ErrorCategory; lesson: LessonSummary | null; errorsTotal: number; errors30: number }[] {
  const db = getDb();
  const d30 = Date.now() - 30 * 864e5;
  const counts = new Map(
    db
      .select({
        category: errors.category,
        total: sql<number>`count(*)`,
        last30: sql<number>`sum(case when ${errors.createdAt} >= ${d30} then 1 else 0 end)`,
      })
      .from(errors).where(eq(errors.subject, currentSubject()))
      .groupBy(errors.category)
      .all()
      .map((r) => [r.category, { total: r.total, last30: r.last30 ?? 0 }] as const),
  );
  const have = lessonCategories();
  return examConfig.errorCategories().categories.map((cat) => {
    const n = counts.get(cat.id) ?? { total: 0, last30: 0 };
    let lesson: LessonSummary | null = null;
    if (have.has(cat.id)) {
      const l = getLesson(cat.id);
      if (l) {
        lesson = {
          category: cat.id,
          name: cat.name,
          group: cat.group,
          title: l.title,
          summary: l.summaryHu,
          practiceCount: l.practice.length,
          errorsTotal: n.total,
          errors30: n.last30,
        };
      }
    }
    return { category: cat, lesson, errorsTotal: n.total, errors30: n.last30 };
  });
}

/** Server-side check of one self-check item of a lesson. */
export function checkLessonItem(category: string, itemId: string, answer: string, seconds = 0): ItemResult | null {
  const lesson = getLesson(category);
  const item = lesson?.practice.find((i) => i.id === itemId);
  if (!lesson || !item) return null;
  if (seconds > 0) logActivity("grammar", Math.min(seconds, 600));
  return checkItem({ options: undefined }, item, answer, { decimalComma: decimalComma() });
}

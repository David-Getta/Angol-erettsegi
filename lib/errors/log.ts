import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { errors, itemAttempts, type ErrorRow } from "@/lib/db/schema";
import type { ObjectiveTask } from "@/lib/content/schema";
import { itemContext } from "@/lib/content/text";
import type { ItemResult } from "@/lib/scoring/check";
import { examConfig } from "@/lib/exam/config";
import { currentSubject } from "@/lib/exam/config";

/** Every wrong objective answer goes into the error log with the correct answer and the reason. */
export function logObjectiveErrors(
  task: ObjectiveTask,
  results: ItemResult[],
  sourceType: string,
  sourceId: string,
): number {
  const db = getDb();
  let n = 0;
  for (const r of results) {
    if (r.correct) continue;
    const item = task.items.find((i) => i.id === r.itemId);
    if (!item) continue;
    const why = item.evidence ? `${item.explanation}\nA szövegben: „${item.evidence}”` : item.explanation;
    db.insert(errors)
      .values({
        subject: task.subject,
        category: r.category,
        original: r.given || "(nem válaszoltál)",
        corrected: r.expectedLabel,
        explanation: why,
        context: itemContext(task, item.id) || item.prompt || null,
        sourceType,
        sourceId,
        taskId: task.id,
        itemId: item.id,
        createdAt: new Date(),
      })
      .run();
    n++;
  }
  return n;
}

export function recentErrors(limit = 50, category?: string): ErrorRow[] {
  return getDb()
    .select()
    .from(errors)
    .where(and(eq(errors.subject, currentSubject()), category ? eq(errors.category, category) : undefined))
    .orderBy(desc(errors.createdAt))
    .limit(limit)
    .all();
}

export type CategoryStat = {
  category: string;
  name: string;
  group: string;
  total: number;
  last30: number;
  prev30: number;
  improving: boolean;
  targetedTried: number;
  targetedPct: number | null;
};

/** Frequency per category with the 30-day trend and the "improving" flag. */
export function categoryStats(): CategoryStat[] {
  const db = getDb();
  const now = Date.now();
  const d30 = new Date(now - 30 * 864e5);
  const d60 = new Date(now - 60 * 864e5);
  const rows = db
    .select({
      category: errors.category,
      total: sql<number>`count(*)`,
      last30: sql<number>`sum(case when ${errors.createdAt} >= ${d30.getTime()} then 1 else 0 end)`,
      prev30: sql<number>`sum(case when ${errors.createdAt} >= ${d60.getTime()} and ${errors.createdAt} < ${d30.getTime()} then 1 else 0 end)`,
    })
    .from(errors).where(eq(errors.subject, currentSubject()))
    .groupBy(errors.category)
    .all();
  const cats = new Map(examConfig.errorCategories().categories.map((c) => [c.id, c]));
  return rows
    .map((r) => {
      const imp = improvingStatus(r.category);
      return {
        category: r.category,
        name: cats.get(r.category)?.name ?? r.category,
        group: cats.get(r.category)?.group ?? "grammar",
        total: r.total,
        last30: r.last30 ?? 0,
        prev30: r.prev30 ?? 0,
        ...imp,
      };
    })
    .sort((a, b) => b.last30 - a.last30 || b.total - a.total);
}

/**
 * A category is "improving" if at least X% of the last N targeted items of
 * that category were correct (N and X: config/app.json → improving).
 */
export function improvingStatus(category: string): { improving: boolean; targetedTried: number; targetedPct: number | null } {
  const { lastN, minPct } = examConfig.app().improving;
  const last = getDb()
    .select({ correct: itemAttempts.correct })
    .from(itemAttempts)
    .where(and(eq(itemAttempts.subject, currentSubject()), eq(itemAttempts.category, category), eq(itemAttempts.mode, "targeted")))
    .orderBy(desc(itemAttempts.createdAt))
    .limit(lastN)
    .all();
  if (last.length === 0) return { improving: false, targetedTried: 0, targetedPct: null };
  const pct = (last.filter((r) => r.correct).length / last.length) * 100;
  return { improving: last.length >= lastN && pct >= minPct, targetedTried: last.length, targetedPct: pct };
}

/** Weekly error counts per category for the trend chart (last `weeks` weeks, oldest first). */
export function weeklyTrend(weeks = 8, categoriesFilter?: string[]): { weekStart: string; counts: Record<string, number> }[] {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() - 7 * (weeks - 1) + 1); // Monday
  const rows = db
    .select({ category: errors.category, createdAt: errors.createdAt })
    .from(errors)
    .where(
      and(
        eq(errors.subject, currentSubject()),
        gte(errors.createdAt, start),
        categoriesFilter?.length ? inArray(errors.category, categoriesFilter) : undefined,
      ),
    )
    .all();
  const out = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    return { weekStart: d.toISOString().slice(0, 10), counts: {} as Record<string, number> };
  });
  for (const r of rows) {
    const idx = Math.floor((r.createdAt.getTime() - start.getTime()) / (7 * 864e5));
    const w = out[Math.min(Math.max(idx, 0), weeks - 1)]!;
    w.counts[r.category] = (w.counts[r.category] ?? 0) + 1;
  }
  return out;
}

export function deleteError(id: number): void {
  getDb().delete(errors).where(eq(errors.id, id)).run();
}

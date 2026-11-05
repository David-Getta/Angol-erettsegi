import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { configFor, subjects, withSubject, type Subject } from "@/lib/exam/config";
import { estimateParts, daysUntil } from "@/lib/dashboard";
import { settingsFor } from "@/lib/settings";
import type { Level } from "@/lib/content/schema";

export type SubjectCard = {
  subject: Subject;
  level: Level;
  examDate: string;
  daysLeft: number;
  taskCount: number;
  configured: boolean;
  estimate: { points: number; max: number } | null;
};

/** One card per subject for the start screen: level, countdown, bank size and the estimated score. */
export function subjectCards(): SubjectCard[] {
  const db = getDb();
  return subjects().map((subject) => {
    const own = settingsFor(subject.id);
    const taskCount =
      db
        .select({ n: sql<number>`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.subject, subject.id), eq(tasks.active, true), eq(tasks.level, own.level)))
        .get()?.n ?? 0;
    let configured = true;
    let estimate: SubjectCard["estimate"] = null;
    try {
      configFor(subject.id).structure();
      estimate = withSubject(subject.id, () => {
        const est = estimateParts(own.level, own.targetPct);
        const known = est.filter((e) => e.points !== null);
        return known.length ? { points: Math.round(known.reduce((n, e) => n + (e.points ?? 0), 0)), max: est.reduce((n, e) => n + e.maxPoints, 0) } : null;
      });
    } catch {
      configured = false;
    }
    return { subject, level: own.level, examDate: own.examDate, daysLeft: daysUntil(own.examDate), taskCount, configured, estimate };
  });
}

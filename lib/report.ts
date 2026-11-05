import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { cards, reviews, submissions } from "@/lib/db/schema";
import type { Level } from "@/lib/content/schema";
import { estimateParts, daysUntil, type PartEstimate } from "@/lib/dashboard";
import { listMocks, type MockResult } from "@/lib/mock";
import { categoryStats } from "@/lib/errors/log";
import { fixedMistakes } from "@/lib/targeted";
import { secondsByDay, streak } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { getContent } from "@/lib/tasks";
import { currentSubject } from "@/lib/exam/config";

/** Haladási jelentés: one printable page of the student's progress (for a teacher or parent). */
export type ProgressReport = {
  level: Level;
  examDate: string;
  daysLeft: number;
  estimates: PartEstimate[];
  estimatedTotal: { points: number; max: number; complete: boolean };
  lastMock: { date: Date; pct: number | null; grade: string | null; complete: boolean } | null;
  mocksDone: number;
  writing: { date: Date; title: string; score: number; max: number }[];
  topErrors: { name: string; last30: number; total: number; improving: boolean }[];
  fixed: { all: number; last30: number };
  vocab: { cards: number; reviews30: number };
  practice: { minutes30: number; activeDays30: number; streak: number };
};

export function progressReport(): ProgressReport {
  const s = getSettings();
  const level = s.level;
  const db = getDb();
  const estimates = estimateParts(level, s.targetPct).filter((e) => e.maxPoints > 0);
  const known = estimates.filter((e) => e.points !== null);
  const mocks = listMocks("mock", level).filter((m) => m.status === "done" || m.status === "awaiting-writing");
  const last = mocks[0];
  const lastResult = (last?.result ?? null) as MockResult | null;
  const writing = db
    .select()
    .from(submissions)
    .where(and(eq(submissions.subject, currentSubject()), eq(submissions.kind, "writing"), eq(submissions.level, level), eq(submissions.status, "graded"), isNotNull(submissions.score)))
    .orderBy(desc(submissions.gradedAt))
    .limit(6)
    .all()
    .map((w) => ({ date: w.gradedAt ?? w.createdAt, title: getContent(w.taskId)?.title ?? w.taskId, score: w.score ?? 0, max: w.maxScore ?? 0 }));
  const since = new Date(Date.now() - 30 * 864e5);
  const byDay = secondsByDay(40);
  const recentDays = [...byDay].filter(([d]) => new Date(d) >= since);
  return {
    level,
    examDate: s.examDate,
    daysLeft: daysUntil(s.examDate),
    estimates,
    estimatedTotal: {
      points: Math.round(known.reduce((n, e) => n + (e.points ?? 0), 0)),
      max: estimates.reduce((n, e) => n + e.maxPoints, 0),
      complete: known.length === estimates.length,
    },
    lastMock: last
      ? { date: last.finishedAt ?? last.createdAt, pct: lastResult?.complete ? lastResult.outcome.pct : null, grade: lastResult?.complete ? `${lastResult.outcome.grade.grade} (${lastResult.outcome.grade.name})` : null, complete: !!lastResult?.complete }
      : null,
    mocksDone: mocks.length,
    writing,
    topErrors: categoryStats()
      .slice(0, 8)
      .map((c) => ({ name: c.name, last30: c.last30, total: c.total, improving: c.improving })),
    fixed: { all: fixedMistakes(), last30: fixedMistakes(30) },
    vocab: {
      cards: db.select({ n: sql<number>`count(*)` }).from(cards).where(eq(cards.subject, currentSubject())).get()?.n ?? 0,
      reviews30:
        db
          .select({ n: sql<number>`count(*)` })
          .from(reviews)
          .innerJoin(cards, eq(cards.id, reviews.cardId))
          .where(and(eq(cards.subject, currentSubject()), gte(reviews.reviewedAt, since)))
          .get()?.n ?? 0,
    },
    practice: {
      minutes30: Math.round(recentDays.reduce((n, [, sec]) => n + sec, 0) / 60),
      activeDays30: recentDays.filter(([, sec]) => sec > 0).length,
      streak: streak(byDay),
    },
  };
}

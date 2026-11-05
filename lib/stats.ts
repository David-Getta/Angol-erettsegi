import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { attempts, itemAttempts, submissions, tasks } from "@/lib/db/schema";
import type { Level } from "@/lib/content/schema";
import type { Feedback } from "@/lib/exchange/schema";
import { localDay, secondsByDay } from "@/lib/activity";

export type Point = { x: string; y: number };
export type Series = { id: string; name: string; points: Point[] };

function dailyAverage(rows: { day: string; pct: number }[]): Point[] {
  const m = new Map<string, { s: number; n: number }>();
  for (const r of rows) {
    const c = m.get(r.day) ?? { s: 0, n: 0 };
    c.s += r.pct;
    c.n++;
    m.set(r.day, c);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, c]) => ({ x, y: Math.round(c.s / c.n) }));
}

/** Percentage per exam part over time (daily averages). */
export function scoreTrend(level: Level, names: Record<string, string>): Series[] {
  const db = getDb();
  const out: Series[] = [];
  for (const section of ["reading", "language-use", "listening"]) {
    const rows = db.select().from(attempts).where(and(eq(attempts.section, section), eq(attempts.level, level))).orderBy(asc(attempts.createdAt)).all();
    out.push({ id: section, name: names[section] ?? section, points: dailyAverage(rows.map((r) => ({ day: localDay(r.createdAt), pct: (r.score / (r.maxScore || 1)) * 100 }))) });
  }
  for (const kind of ["writing", "speaking"]) {
    const rows = db
      .select()
      .from(submissions)
      .where(and(eq(submissions.kind, kind), eq(submissions.level, level), eq(submissions.status, "graded")))
      .orderBy(asc(submissions.gradedAt))
      .all();
    out.push({ id: kind, name: names[kind] ?? kind, points: dailyAverage(rows.map((r) => ({ day: localDay(r.gradedAt ?? r.createdAt), pct: ((r.score ?? 0) / (r.maxScore || 1)) * 100 }))) });
  }
  return out.filter((s) => s.points.length > 0);
}

export type AccuracyRow = { key: string; label: string; correct: number; total: number; pct: number };

export function accuracyByType(level: Level, typeName: (section: string, type: string) => string, sectionName: (s: string) => string): AccuracyRow[] {
  const db = getDb();
  const rows = db.select({ taskId: attempts.taskId, score: attempts.score, max: attempts.maxScore }).from(attempts).where(eq(attempts.level, level)).all();
  if (!rows.length) return [];
  const meta = new Map(
    db
      .select({ id: tasks.id, section: tasks.section, type: tasks.type })
      .from(tasks)
      .where(inArray(tasks.id, [...new Set(rows.map((r) => r.taskId))]))
      .all()
      .map((t) => [t.id, t]),
  );
  const agg = new Map<string, AccuracyRow>();
  for (const r of rows) {
    const t = meta.get(r.taskId);
    if (!t) continue;
    const key = `${t.section}:${t.type}`;
    const a = agg.get(key) ?? { key, label: `${sectionName(t.section)} – ${typeName(t.section, t.type)}`, correct: 0, total: 0, pct: 0 };
    a.correct += r.score;
    a.total += r.max;
    agg.set(key, a);
  }
  return [...agg.values()].map((a) => ({ ...a, pct: a.total ? (a.correct / a.total) * 100 : 0 })).sort((a, b) => a.pct - b.pct);
}

export function accuracyByCategory(names: Record<string, string>): AccuracyRow[] {
  const rows = getDb().select({ category: itemAttempts.category, correct: itemAttempts.correct }).from(itemAttempts).all();
  const agg = new Map<string, AccuracyRow>();
  for (const r of rows) {
    const a = agg.get(r.category) ?? { key: r.category, label: names[r.category] ?? r.category, correct: 0, total: 0, pct: 0 };
    a.total++;
    if (r.correct) a.correct++;
    agg.set(r.category, a);
  }
  return [...agg.values()].map((a) => ({ ...a, pct: (a.correct / a.total) * 100 })).sort((a, b) => a.pct - b.pct);
}

export function timePerDay(days = 30): Point[] {
  const by = secondsByDay(days + 1);
  const out: Point[] = [];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const k = localDay(d);
    out.push({ x: k, y: Math.round((by.get(k) ?? 0) / 60) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function timePerWeek(weeks = 12): Point[] {
  const by = secondsByDay(weeks * 7 + 7);
  const out: Point[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * (weeks - 1));
  for (let w = 0; w < weeks; w++) {
    let sum = 0;
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * w);
    const label = localDay(d);
    for (let i = 0; i < 7; i++) {
      sum += by.get(localDay(d)) ?? 0;
      d.setDate(d.getDate() + 1);
    }
    out.push({ x: label, y: Math.round(sum / 60) });
  }
  return out;
}

/** Writing: percentage per rubric criterion over the graded submissions. */
export function writingCriteriaTrend(level: Level, criterionNames: Record<string, string>): Series[] {
  const rows = getDb()
    .select()
    .from(submissions)
    .where(and(eq(submissions.kind, "writing"), eq(submissions.level, level), eq(submissions.status, "graded")))
    .orderBy(asc(submissions.gradedAt))
    .all();
  const series = new Map<string, Series>();
  for (const r of rows) {
    const fb = r.feedback as Feedback | null;
    if (!fb) continue;
    const day = localDay(r.gradedAt ?? r.createdAt);
    for (const c of fb.criteria) {
      const s = series.get(c.id) ?? { id: c.id, name: criterionNames[c.id] ?? c.id, points: [] };
      s.points.push({ x: day, y: Math.round((c.score / c.max) * 100) });
      series.set(c.id, s);
    }
  }
  return [...series.values()].map((s) => ({ ...s, points: dailyAverage(s.points.map((p) => ({ day: p.x, pct: p.y }))) }));
}

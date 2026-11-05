import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activity } from "@/lib/db/schema";
import { currentSubject } from "@/lib/exam/config";

export function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Logs practice time (seconds) for the streak and the weekly total. */
export function logActivity(section: string, seconds: number, at: Date = new Date()): void {
  const s = Math.round(seconds);
  if (s <= 0) return;
  getDb().insert(activity).values({ subject: currentSubject(), day: localDay(at), section, seconds: Math.min(s, 4 * 3600), createdAt: at }).run();
}

export function secondsByDay(sinceDays = 60): Map<string, number> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const rows = getDb()
    .select({ day: activity.day, seconds: sql<number>`sum(${activity.seconds})` })
    .from(activity)
    .where(and(eq(activity.subject, currentSubject()), gte(activity.day, localDay(since))))
    .groupBy(activity.day)
    .all();
  return new Map(rows.map((r) => [r.day, r.seconds]));
}

/** Consecutive practice days ending today (or yesterday, if today has no practice yet). */
export function streak(byDay: Map<string, number> = secondsByDay(400), today: Date = new Date()): number {
  const d = new Date(today);
  if (!byDay.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (byDay.has(localDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Practice seconds in the last 7 days including today. */
export function weekSeconds(byDay: Map<string, number> = secondsByDay(10), today: Date = new Date()): number {
  let total = 0;
  const d = new Date(today);
  for (let i = 0; i < 7; i++) {
    total += byDay.get(localDay(d)) ?? 0;
    d.setDate(d.getDate() - 1);
  }
  return total;
}

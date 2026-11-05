import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { attempts, submissions, tasks, type TaskRow } from "@/lib/db/schema";
import type { Content, Level, ObjectiveTask, Section, SpeakingTask, VocabDeck, WritingTask } from "@/lib/content/schema";
import { examConfig } from "@/lib/exam/config";

export type TaskSummary = {
  id: string;
  section: string;
  type: string;
  level: string;
  source: string;
  topic: string;
  title: string;
  itemCount: number;
  reservedFor: string | null;
  categories: string[];
  attempts: number;
  bestPct: number | null;
  lastPct: number | null;
  lastAt: Date | null;
};

export function getTaskRow(id: string): TaskRow | undefined {
  return getDb().select().from(tasks).where(eq(tasks.id, id)).get();
}

export function getContent<T extends Content = Content>(id: string): T | null {
  const row = getTaskRow(id);
  return row ? (row.content as T) : null;
}

export const getObjective = (id: string) => getContent<ObjectiveTask>(id);
export const getWriting = (id: string) => getContent<WritingTask>(id);
export const getSpeaking = (id: string) => getContent<SpeakingTask>(id);
export const getDeck = (id: string) => getContent<VocabDeck>(id);

/** Tasks of a section/level with the user's attempt stats. */
export function listTasks(section: Section, level: Level): TaskSummary[] {
  const db = getDb();
  const rows = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.section, section), eq(tasks.level, level), eq(tasks.active, true)))
    .all();
  const ids = rows.map((r) => r.id);
  const stats = new Map<string, { n: number; best: number | null; last: number | null; lastAt: Date | null }>();
  if (ids.length) {
    if (section === "writing" || section === "speaking") {
      const subs = db
        .select()
        .from(submissions)
        .where(inArray(submissions.taskId, ids))
        .orderBy(desc(submissions.createdAt))
        .all();
      for (const s of subs) {
        const pct = s.score !== null && s.maxScore ? (s.score / s.maxScore) * 100 : null;
        const cur = stats.get(s.taskId) ?? { n: 0, best: null, last: null, lastAt: null };
        cur.n++;
        if (cur.lastAt === null) {
          cur.lastAt = s.createdAt;
          cur.last = pct;
        }
        if (pct !== null && (cur.best === null || pct > cur.best)) cur.best = pct;
        stats.set(s.taskId, cur);
      }
    } else {
      const att = db.select().from(attempts).where(inArray(attempts.taskId, ids)).orderBy(desc(attempts.createdAt)).all();
      for (const a of att) {
        const pct = a.maxScore ? (a.score / a.maxScore) * 100 : 0;
        const cur = stats.get(a.taskId) ?? { n: 0, best: null, last: null, lastAt: null };
        cur.n++;
        if (cur.lastAt === null) {
          cur.lastAt = a.createdAt;
          cur.last = pct;
        }
        if (cur.best === null || pct > cur.best) cur.best = pct;
        stats.set(a.taskId, cur);
      }
    }
  }
  return rows
    .map((r) => {
      const s = stats.get(r.id);
      return {
        id: r.id,
        section: r.section,
        type: r.type,
        level: r.level,
        source: r.source,
        topic: r.topic,
        title: r.title,
        itemCount: r.itemCount,
        reservedFor: r.reservedFor,
        categories: r.categories,
        attempts: s?.n ?? 0,
        bestPct: s?.best ?? null,
        lastPct: s?.last ?? null,
        lastAt: s?.lastAt ?? null,
      };
    })
    .sort((a, b) => (a.source === b.source ? a.title.localeCompare(b.title, "hu") : a.source === "official" ? -1 : 1));
}

/** Set of task ids the user has already worked on (attempt or submission). */
export function usedTaskIds(): Set<string> {
  const db = getDb();
  const a = db.selectDistinct({ id: attempts.taskId }).from(attempts).all();
  const s = db.selectDistinct({ id: submissions.taskId }).from(submissions).all();
  return new Set([...a, ...s].map((r) => r.id));
}

export type StockRow = {
  section: Section;
  level: Level;
  type: string;
  typeName: string;
  total: number;
  unused: number;
  low: boolean;
};

/** Unsolved tasks per section / level / task type, for the stock indicator. */
export function contentStock(level?: Level): StockRow[] {
  const db = getDb();
  const used = usedTaskIds();
  const threshold = examConfig.app().lowStock.threshold;
  const tt = examConfig.taskTypes();
  const rows = db
    .select({ id: tasks.id, section: tasks.section, level: tasks.level, type: tasks.type })
    .from(tasks)
    .where(level ? and(eq(tasks.active, true), eq(tasks.level, level)) : eq(tasks.active, true))
    .all();
  const map = new Map<string, StockRow>();
  for (const r of rows) {
    if (r.section === "vocabulary") continue;
    const key = `${r.section}|${r.level}|${r.type}`;
    const sec = r.section as Exclude<Section, "vocabulary">;
    const cur =
      map.get(key) ??
      ({
        section: sec,
        level: r.level as Level,
        type: r.type,
        typeName: tt[sec]?.find((t) => t.id === r.type)?.name ?? r.type,
        total: 0,
        unused: 0,
        low: false,
      } satisfies StockRow);
    cur.total++;
    if (!used.has(r.id)) cur.unused++;
    map.set(key, cur);
  }
  const out = [...map.values()];
  for (const r of out) r.low = r.unused <= threshold;
  return out.sort((a, b) => a.section.localeCompare(b.section) || a.typeName.localeCompare(b.typeName, "hu"));
}

/** Count of active tasks per section and level (for quick checks). */
export function countTasks(section: Section, level: Level): number {
  const r = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.section, section), eq(tasks.level, level), eq(tasks.active, true)))
    .get();
  return r?.n ?? 0;
}

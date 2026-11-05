import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { cards, tasks } from "@/lib/db/schema";
import type { Guide, Level, SpeakingTask, WritingTask } from "@/lib/content/schema";
import { normalizeAnswer } from "@/lib/scoring/check";
import { noteKey } from "@/lib/vocab/cards";
import { currentSubject } from "@/lib/exam/config";

/**
 * Kifejezéstár: the useful phrases of every writing and speaking card of a
 * level, grouped by task type and de-duplicated.
 */

export type Phrase = { en: string; hu: string; count: number; taskIds: string[]; inCards: boolean };
export type PhraseGroup = { section: "writing" | "speaking"; type: string; phrases: Phrase[] };

export function phraseBank(level: Level): PhraseGroup[] {
  const db = getDb();
  const rows = db
    .select({ id: tasks.id, section: tasks.section, type: tasks.type, content: tasks.content })
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.level, level), eq(tasks.active, true), inArray(tasks.section, ["writing", "speaking"])))
    .all();
  const known = new Set(db.select({ k: cards.noteKey }).from(cards).where(eq(cards.subject, currentSubject())).all().map((r) => r.k));
  const groups = new Map<string, PhraseGroup & { byKey: Map<string, Phrase> }>();
  for (const r of rows) {
    const c = r.content as WritingTask | SpeakingTask;
    const key = `${r.section}|${r.type}`;
    const g = groups.get(key) ?? { section: r.section as "writing" | "speaking", type: r.type, phrases: [], byKey: new Map() };
    for (const p of c.usefulPhrases ?? []) {
      const k = normalizeAnswer(p.en);
      const cur = g.byKey.get(k);
      if (cur) {
        cur.count++;
        if (!cur.taskIds.includes(r.id)) cur.taskIds.push(r.id);
      } else {
        g.byKey.set(k, { en: p.en, hu: p.hu, count: 1, taskIds: [r.id], inCards: known.has(noteKey(p.en)) });
      }
    }
    groups.set(key, g);
  }
  // the phrases of the writing / speaking guides join the groups of their text / task type (only types this level has)
  const guides = db.select({ id: tasks.id, content: tasks.content }).from(tasks).where(and(eq(tasks.subject, currentSubject()), eq(tasks.section, "guide"), eq(tasks.active, true))).all();
  for (const r of guides) {
    const gd = r.content as Guide;
    if (gd.type === "exam") continue;
    const g = groups.get(`${gd.type}|${gd.target}`);
    if (!g) continue;
    for (const p of gd.phrases) {
      const k = normalizeAnswer(p.en);
      const cur = g.byKey.get(k);
      if (cur) cur.count++;
      else g.byKey.set(k, { en: p.en, hu: p.hu, count: 1, taskIds: [r.id], inCards: known.has(noteKey(p.en)) });
    }
  }
  return [...groups.values()]
    .map(({ byKey, ...g }) => ({ ...g, phrases: [...byKey.values()].sort((a, b) => b.count - a.count || a.en.localeCompare(b.en)) }))
    .filter((g) => g.phrases.length > 0)
    .sort((a, b) => a.section.localeCompare(b.section) || a.type.localeCompare(b.type));
}

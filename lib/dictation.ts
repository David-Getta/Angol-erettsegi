import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import type { Level, ObjectiveTask } from "@/lib/content/schema";
import { wordCount } from "@/lib/content/text";
import { currentSubject } from "@/lib/exam/config";

/**
 * Diktálás: sentences from the listening scripts of a level (never from tasks
 * reserved for the mock exam or the diagnostic), read aloud by the speaker's
 * voice and typed back by the student.
 */
export type DictationSentence = {
  key: string;
  text: string;
  taskId: string;
  taskTitle: string;
  gender: "female" | "male";
  accent: string;
};

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

export function dictationSentences(level: Level, count: number, seed = Date.now()): DictationSentence[] {
  const rows = getDb()
    .select({ content: tasks.content })
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.section, "listening"), eq(tasks.level, level), eq(tasks.active, true), isNull(tasks.reservedFor)))
    .all();
  const pool: DictationSentence[] = [];
  for (const r of rows) {
    const t = r.content as ObjectiveTask;
    if (!t.listening) continue;
    t.listening.script.forEach((line, li) => {
      const sp = t.listening!.speakers.find((x) => x.id === line.speaker);
      splitSentences(line.text).forEach((s, si) => {
        const n = wordCount(s);
        const [min, max] = level === "emelt" ? [8, 20] : [6, 15];
        if (n < min || n > max) return;
        pool.push({ key: `${t.id}:${li}:${si}`, text: s, taskId: t.id, taskTitle: t.title, gender: sp?.gender ?? "female", accent: sp?.accent ?? "en-GB" });
      });
    });
  }
  const rnd = seeded(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

export { compareWords, type DiffToken } from "@/lib/scoring/words";

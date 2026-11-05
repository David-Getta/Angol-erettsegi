import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { errors, itemAttempts, tasks } from "@/lib/db/schema";
import type { Item, Level, ObjectiveTask } from "@/lib/content/schema";
import { itemContext } from "@/lib/content/text";
import { checkItem } from "@/lib/scoring/check";
import { acceptNearMiss } from "@/lib/attempts";
import { logActivity } from "@/lib/activity";
import { getObjective } from "@/lib/tasks";
import { examConfig } from "@/lib/exam/config";
import { currentSubject } from "@/lib/exam/config";

/** One item pulled out of its task for targeted practice. */
export type TargetedItem = {
  key: string; // taskId:itemId
  taskId: string;
  taskTitle: string;
  taskType: string;
  section: string;
  instructions: string;
  context: string;
  item: Item;
  options: ObjectiveTask["options"];
};

function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr];
  let s = seed % 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** All bank items of the given categories (language use first, then reading/listening). */
export function bankItemsFor(categories: string[], level: Level): TargetedItem[] {
  const db = getDb();
  const rows = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.level, level), eq(tasks.active, true)))
    .all()
    .filter((r) => ["language-use", "reading", "listening"].includes(r.section) && r.categories.some((c) => categories.includes(c)));
  const parts = [...examConfig.structure().levels.kozep.parts, ...examConfig.structure().levels.emelt.parts];
  const targetedParts = new Set(parts.filter((p) => p.features.targeted).map((p) => p.id));
  const audioParts = new Set(parts.filter((p) => p.features.audio).map((p) => p.id));
  const out: TargetedItem[] = [];
  for (const r of rows) {
    const t = r.content as ObjectiveTask;
    // reading/listening items need the whole text; only standalone-able items are used
    for (const item of t.items) {
      if (!categories.includes(item.category)) continue;
      // reading/listening items need the whole text; only standalone items (with a prompt) and parts without audio are used
      if (!targetedParts.has(t.section) && !item.prompt) continue;
      if (audioParts.has(t.section)) continue;
      out.push({
        key: `${t.id}:${item.id}`,
        taskId: t.id,
        taskTitle: t.title,
        taskType: t.type,
        section: t.section,
        instructions: t.instructions,
        context: itemContext(t, item.id),
        item,
        options: t.options,
      });
    }
  }
  return out;
}

/**
 * Picks items for a targeted round: items answered wrong before come first,
 * then never-seen items, then the rest.
 */
export function pickTargeted(categories: string[], level: Level, count: number): TargetedItem[] {
  const db = getDb();
  const pool = bankItemsFor(categories, level).filter((i) => i.section === "language-use" || i.item.kind !== "match");
  const history = db.select().from(itemAttempts).where(eq(itemAttempts.subject, currentSubject())).all();
  const lastCorrect = new Map<string, boolean>();
  for (const h of history.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) lastCorrect.set(`${h.taskId}:${h.itemId}`, h.correct);
  const wrongBefore = shuffle(pool.filter((p) => lastCorrect.get(p.key) === false));
  const unseen = shuffle(pool.filter((p) => !lastCorrect.has(p.key)));
  const rest = shuffle(pool.filter((p) => lastCorrect.get(p.key) === true));
  return [...wrongBefore, ...unseen, ...rest].slice(0, count);
}

/**
 * Language-use items whose LAST attempt was wrong and is at least `minAgeHours`
 * old – re-asked until the student gets them right (then they leave the list).
 */
export function pickMistakes(level: Level, count: number, minAgeHours: number, now = Date.now()): { due: TargetedItem[]; later: number } {
  const db = getDb();
  const history = db.select().from(itemAttempts).where(eq(itemAttempts.subject, currentSubject())).all();
  const last = new Map<string, { correct: boolean; at: number }>();
  for (const h of history.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    last.set(`${h.taskId}:${h.itemId}`, { correct: h.correct, at: h.createdAt.getTime() });
  }
  const wrongKeys = new Set([...last].filter(([, v]) => !v.correct).map(([k]) => k));
  if (wrongKeys.size === 0) return { due: [], later: 0 };
  const categories = examConfig.errorCategories().categories.map((c) => c.id);
  const pool = bankItemsFor(categories, level).filter((i) => i.section === "language-use" && wrongKeys.has(i.key));
  const cutoff = now - minAgeHours * 3600e3;
  const due = pool.filter((i) => last.get(i.key)!.at <= cutoff).sort((a, b) => last.get(a.key)!.at - last.get(b.key)!.at);
  return { due: due.slice(0, count), later: pool.length - due.length + Math.max(0, due.length - count) };
}

/** Items answered wrong at some point whose latest attempt is correct (optionally: fixed within the last `sinceDays`). */
export function fixedMistakes(sinceDays?: number, now = Date.now()): number {
  const history = getDb().select().from(itemAttempts).where(eq(itemAttempts.subject, currentSubject())).all();
  const state = new Map<string, { everWrong: boolean; last: boolean; at: number }>();
  for (const h of history.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const k = `${h.taskId}:${h.itemId}`;
    const cur = state.get(k) ?? { everWrong: false, last: false, at: 0 };
    if (!h.correct) cur.everWrong = true;
    cur.last = h.correct;
    cur.at = h.createdAt.getTime();
    state.set(k, cur);
  }
  const since = sinceDays === undefined ? 0 : now - sinceDays * 864e5;
  return [...state.values()].filter((v) => v.everWrong && v.last && v.at >= since).length;
}

export function countBankItems(category: string, level: Level): number {
  return bankItemsFor([category], level).length;
}

export function checkTargetedItem(key: string, given: string) {
  const [taskId, itemId] = key.split(":");
  const task = getObjective(taskId!);
  const item = task?.items.find((i) => i.id === itemId);
  if (!task || !item) throw new Error("Ismeretlen item.");
  const r = checkItem(task, item, given, { acceptNearMiss: acceptNearMiss(task.section) });
  const db = getDb();
  db.insert(itemAttempts)
    .values({ subject: task.subject, taskId: task.id, itemId: item.id, category: item.category, section: task.section, correct: r.correct, answer: given, mode: "targeted", createdAt: new Date() })
    .run();
  if (!r.correct) {
    db.insert(errors)
      .values({
        subject: task.subject,
        category: item.category,
        original: given || "(nem válaszoltál)",
        corrected: r.expectedLabel,
        explanation: item.evidence ? `${item.explanation}\nA szövegben: „${item.evidence}”` : item.explanation,
        context: itemContext(task, item.id),
        sourceType: task.section,
        sourceId: `targeted:${key}`,
        taskId: task.id,
        itemId: item.id,
        createdAt: new Date(),
      })
      .run();
  }
  return { result: r, explanation: item.explanation, evidence: item.evidence ?? null, wrongOptions: "wrongOptions" in item ? item.wrongOptions ?? null : null };
}

export function logTargetedTime(seconds: number, section = "language-use") {
  logActivity(section, seconds);
}

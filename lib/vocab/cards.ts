import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, gte, inArray, lte, sql, desc, like, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { cards, reviews, tasks, type CardRow } from "@/lib/db/schema";
import type { Level, ObjectiveTask, VocabDeck } from "@/lib/content/schema";
import { normalizeAnswer } from "@/lib/scoring/check";
import { getSettings, type CardType } from "@/lib/settings";
import { paths } from "@/lib/paths";
import { logActivity } from "@/lib/activity";
import { newFsrsState, review, type StoredFsrs } from "./fsrs";
import { currentSubject } from "@/lib/exam/config";

export function noteKey(term: string): string {
  return normalizeAnswer(term).replace(/[^\p{L}\p{N}' -]/gu, "").trim();
}

type Lookup = { term: string; meaning: string; example?: string; collocation?: string; topic?: string; level?: string };

function candidates(term: string): string[] {
  const k = noteKey(term);
  const out = new Set([k]);
  if (k.endsWith("ies")) out.add(k.slice(0, -3) + "y");
  if (k.endsWith("es")) out.add(k.slice(0, -2));
  if (k.endsWith("s")) out.add(k.slice(0, -1));
  if (k.endsWith("ed")) {
    out.add(k.slice(0, -2));
    out.add(k.slice(0, -1));
  }
  if (k.endsWith("ing")) {
    out.add(k.slice(0, -3));
    out.add(k.slice(0, -3) + "e");
  }
  if (k.endsWith("ly")) out.add(k.slice(0, -2));
  return [...out].filter((x) => x.length > 1);
}

/** Looks a word up in the vocabulary decks and in the glossaries of the bank. */
export function lookupWord(term: string, preferLevel?: Level): Lookup | null {
  const db = getDb();
  const cands = candidates(term);
  const rows = db
    .select({ section: tasks.section, content: tasks.content, level: tasks.level })
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.active, true), inArray(tasks.section, ["vocabulary", "reading"])))
    .all();
  let best: Lookup | null = null;
  for (const r of rows) {
    if (r.section === "vocabulary") {
      const deck = r.content as VocabDeck;
      const hit = deck.cards.find((c) => cands.includes(noteKey(c.term)));
      if (hit) {
        const l = { term: hit.term, meaning: hit.meaning, example: hit.example, collocation: hit.collocation, topic: deck.topic, level: deck.level };
        if (!best || r.level === preferLevel) best = l;
      }
    } else {
      const t = r.content as ObjectiveTask;
      const g = t.glossary?.find((x) => cands.includes(noteKey(x.term)));
      if (g && !best) best = { term: g.term, meaning: g.meaning, example: g.example, topic: t.topic, level: t.level };
    }
  }
  return best;
}

export type AddWordInput = {
  /** Subject of the card (default: the current one). */
  subject?: string;
  term: string;
  meaning?: string | null;
  example?: string | null;
  collocation?: string | null;
  context?: string | null;
  sourceType: string;
  sourceId?: string | null;
  topic?: string | null;
  level?: string | null;
  types?: CardType[];
};

/**
 * Adds a word as cards of the configured types. Missing meaning → the cards
 * are marked incomplete and /szokincs fills them in later.
 */
export function addWord(input: AddWordInput): { created: number; incomplete: boolean; term: string } {
  const db = getDb();
  const s = getSettings();
  const term = input.term.trim().replace(/\s+/g, " ");
  if (!term) return { created: 0, incomplete: false, term };
  const found = input.meaning ? null : lookupWord(term, s.level);
  const meaning = (input.meaning ?? found?.meaning ?? "").trim();
  const example = (input.example ?? found?.example ?? input.context ?? "").trim() || null;
  const collocation = (input.collocation ?? found?.collocation ?? "").trim() || null;
  const front = found?.term ?? term;
  const key = noteKey(front);
  const incomplete = !meaning;
  const types = (input.types ?? s.cardTypes).filter((tp) => {
    if (tp === "cloze") return !!example && containsTerm(example, front);
    if (tp === "collocation") return !!collocation;
    if (tp === "hu-en") return !!meaning || incomplete;
    return true;
  });
  let created = 0;
  const now = new Date();
  for (const type of types.length ? types : (["en-hu"] as CardType[])) {
    const res = db
      .insert(cards)
      .values({
        subject: input.subject ?? currentSubject(),
        noteKey: key,
        front,
        back: meaning,
        example,
        collocation,
        type,
        incomplete,
        fsrsState: newFsrsState(now),
        dueAt: now,
        isNew: true,
        topic: input.topic ?? found?.topic ?? null,
        level: input.level ?? found?.level ?? s.level,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        context: input.context ?? null,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
    created += res.changes;
  }
  if (incomplete) writeIncompleteRequests();
  return { created, incomplete, term: front };
}

/**
 * A "fix" card from a correction (error log, grading feedback): the prompt is
 * the wrong form in its context, the answer the corrected form, the back the
 * Hungarian explanation. Scheduled with FSRS like every other card.
 */
export function addFixCard(input: {
  subject?: string;
  original: string;
  corrected: string;
  explanation: string;
  context?: string | null;
  sourceType: string;
  sourceId?: string | null;
  level?: string | null;
}): { created: number } {
  const original = input.original.trim();
  const corrected = input.corrected.trim();
  if (!corrected || !input.explanation.trim()) return { created: 0 };
  const now = new Date();
  const res = getDb()
    .insert(cards)
    .values({
      subject: input.subject ?? currentSubject(),
      noteKey: `fix:${noteKey(original)}>${noteKey(corrected)}`.slice(0, 300),
      front: corrected,
      back: input.explanation.trim(),
      example: original,
      collocation: null,
      type: "fix",
      incomplete: false,
      fsrsState: newFsrsState(now),
      dueAt: now,
      isNew: true,
      topic: null,
      level: input.level ?? getSettings().level,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      context: input.context?.trim() || null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();
  return { created: res.changes };
}

export function containsTerm(sentence: string, term: string): boolean {
  return clozeFor(sentence, term) !== null;
}

const IRREGULAR: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being"], have: ["has", "had", "having"], do: ["does", "did", "done", "doing"],
  go: ["goes", "went", "gone"], make: ["made", "makes", "making"], take: ["took", "taken", "takes", "taking"],
  get: ["got", "gotten", "gets", "getting"], give: ["gave", "given", "gives", "giving"], come: ["came", "comes", "coming"],
  see: ["saw", "seen", "sees"], know: ["knew", "known", "knows"], think: ["thought", "thinks"], find: ["found", "finds"],
  tell: ["told", "tells"], say: ["said", "says"], buy: ["bought", "buys"], bring: ["brought", "brings"], catch: ["caught"],
  teach: ["taught"], keep: ["kept"], leave: ["left"], feel: ["felt"], meet: ["met"], pay: ["paid"], sell: ["sold"],
  send: ["sent"], spend: ["spent"], build: ["built"], lose: ["lost"], hold: ["held"], stand: ["stood"], understand: ["understood"],
  run: ["ran"], begin: ["began", "begun"], break: ["broke", "broken"], choose: ["chose", "chosen"], drive: ["drove", "driven"],
  eat: ["ate", "eaten"], fall: ["fell", "fallen"], forget: ["forgot", "forgotten"], grow: ["grew", "grown"], rise: ["rose", "risen"],
  speak: ["spoke", "spoken"], steal: ["stole", "stolen"], write: ["wrote", "written"], wear: ["wore", "worn"], win: ["won"],
  lead: ["led"], read: ["read"], put: ["put"], set: ["set"], cut: ["cut"], let: ["let"], fly: ["flew", "flown", "flies"],
  child: ["children"], person: ["people"], man: ["men"], woman: ["women"], foot: ["feet"], tooth: ["teeth"], mouse: ["mice"],
};

/** Example sentence with the term blanked out (tolerates simple inflection and common irregular forms). */
export function clozeFor(sentence: string, term: string): string | null {
  const words = term
    .replace(/\b(sth|sb|someone|something|one's)\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alt = (w: string) => {
    const lw = w.toLowerCase();
    const stem = lw.length > 4 ? lw.slice(0, lw.length - (/[ey]$/.test(lw) ? 1 : 0)) : lw;
    const forms = [`${esc(stem)}[a-z]*`, ...(IRREGULAR[lw] ?? []).map(esc)];
    return `(?:${forms.join("|")})`;
  };
  const re = new RegExp(`\\b${words.map(alt).join("\\s+(?:\\w+\\s+)?")}\\b`, "i");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, (m) => "_".repeat(Math.min(14, Math.max(5, m.length))));
}

export function addDeck(deckId: string): number {
  const db = getDb();
  const row = db.select().from(tasks).where(eq(tasks.id, deckId)).get();
  if (!row || row.section !== "vocabulary") throw new Error("Ismeretlen pakli.");
  const deck = row.content as VocabDeck;
  let n = 0;
  for (const c of deck.cards) {
    n += addWord({
      term: c.term,
      meaning: c.meaning,
      example: c.example,
      collocation: c.collocation ?? null,
      sourceType: "bank",
      sourceId: deck.id,
      topic: deck.topic,
      level: deck.level,
    }).created;
  }
  return n;
}

export type DeckStatus = { id: string; title: string; topic: string; level: string; source: string; size: number; added: number };

export function deckStatuses(level: Level): DeckStatus[] {
  const db = getDb();
  const decks = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.section, "vocabulary"), eq(tasks.level, level), eq(tasks.active, true)))
    .all();
  const keys = new Set(db.selectDistinct({ k: cards.noteKey }).from(cards).where(eq(cards.subject, currentSubject())).all().map((r) => r.k));
  return decks
    .map((d) => {
      const deck = d.content as VocabDeck;
      return {
        id: d.id,
        title: d.title,
        topic: d.topic,
        level: d.level,
        source: d.source,
        size: deck.cards.length,
        added: deck.cards.filter((c) => keys.has(noteKey(c.term))).length,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "hu"));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayCounts(): { reviewed: number; newDone: number } {
  const r = getDb()
    .select({ n: sql<number>`count(*)`, nw: sql<number>`sum(case when ${reviews.wasNew} then 1 else 0 end)` })
    .from(reviews)
    .where(gte(reviews.reviewedAt, startOfToday()))
    .get();
  return { reviewed: r?.n ?? 0, newDone: r?.nw ?? 0 };
}

export type DueInfo = { dueReviews: number; newAvailable: number; newAllowed: number; total: number };

export function dueInfo(now: Date = new Date()): DueInfo {
  const db = getDb();
  const s = getSettings();
  const { reviewed, newDone } = todayCounts();
  const dueReviews =
    db
      .select({ n: sql<number>`count(*)` })
      .from(cards)
      .where(and(eq(cards.subject, currentSubject()), eq(cards.isNew, false), eq(cards.suspended, false), eq(cards.incomplete, false), lte(cards.dueAt, now)))
      .get()?.n ?? 0;
  const newAvailable =
    db
      .select({ n: sql<number>`count(*)` })
      .from(cards)
      .where(and(eq(cards.subject, currentSubject()), eq(cards.isNew, true), eq(cards.suspended, false), eq(cards.incomplete, false)))
      .get()?.n ?? 0;
  const newAllowed = Math.max(0, Math.min(newAvailable, s.dailyNewCards - newDone));
  const reviewsAllowed = Math.max(0, Math.min(dueReviews, s.dailyMaxReviews - (reviewed - newDone)));
  return { dueReviews: reviewsAllowed, newAvailable, newAllowed, total: reviewsAllowed + newAllowed };
}

/** The queue for a review session: due reviews first, then today's new cards (one card per word per day). */
export function reviewQueue(now: Date = new Date()): CardRow[] {
  const db = getDb();
  const info = dueInfo(now);
  const due = db
    .select()
    .from(cards)
    .where(and(eq(cards.subject, currentSubject()), eq(cards.isNew, false), eq(cards.suspended, false), eq(cards.incomplete, false), lte(cards.dueAt, now)))
    .orderBy(asc(cards.dueAt))
    .limit(info.dueReviews)
    .all();
  const fresh = db
    .select()
    .from(cards)
    .where(and(eq(cards.subject, currentSubject()), eq(cards.isNew, true), eq(cards.suspended, false), eq(cards.incomplete, false)))
    .orderBy(asc(cards.createdAt), asc(cards.id))
    .limit(info.newAllowed * 4)
    .all();
  // introduce at most one new card type per word per session
  const seen = new Set(due.map((c) => c.noteKey));
  const newOnes: CardRow[] = [];
  for (const c of fresh) {
    if (newOnes.length >= info.newAllowed) break;
    if (seen.has(c.noteKey)) continue;
    seen.add(c.noteKey);
    newOnes.push(c);
  }
  return [...due, ...newOnes];
}

export function reviewCard(cardId: number, rating: 1 | 2 | 3 | 4, durationMs: number): CardRow {
  const db = getDb();
  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) throw new Error("Ismeretlen kártya.");
  const now = new Date();
  const { state, due } = review(card.fsrsState as StoredFsrs | null, rating, now);
  db.update(cards).set({ fsrsState: state, dueAt: due, isNew: false }).where(eq(cards.id, cardId)).run();
  db.insert(reviews).values({ cardId, rating, wasNew: card.isNew, durationMs: Math.max(0, Math.round(durationMs)), reviewedAt: now }).run();
  logActivity("vocabulary", Math.min(120, durationMs / 1000));
  return db.select().from(cards).where(eq(cards.id, cardId)).get()!;
}

export function listCards(opts: { q?: string; incompleteOnly?: boolean; limit?: number } = {}): CardRow[] {
  const db = getDb();
  const conds = [];
  if (opts.incompleteOnly) conds.push(eq(cards.incomplete, true));
  if (opts.q) conds.push(or(like(cards.front, `%${opts.q}%`), like(cards.back, `%${opts.q}%`))!);
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.subject, currentSubject()), ...conds))
    .orderBy(desc(cards.createdAt), asc(cards.noteKey))
    .limit(opts.limit ?? 500)
    .all();
}

export function incompleteCount(): number {
  return (
    getDb()
      .select({ n: sql<number>`count(distinct ${cards.noteKey})` })
      .from(cards)
      .where(and(eq(cards.subject, currentSubject()), eq(cards.incomplete, true)))
      .get()?.n ?? 0
  );
}

export function updateWord(key: string, patch: { back?: string; example?: string | null; collocation?: string | null }): void {
  const db = getDb();
  const set: Partial<typeof cards.$inferInsert> = { ...patch };
  if (patch.back !== undefined) set.incomplete = !patch.back.trim();
  db.update(cards).set(set).where(eq(cards.noteKey, key)).run();
  const rows = db.select().from(cards).where(and(eq(cards.subject, currentSubject()), eq(cards.noteKey, key))).all();
  const first = rows[0];
  if (first && !first.incomplete) {
    // create the card types that became possible (cloze needs an example, collocation needs one)
    const types = getSettings().cardTypes;
    for (const tp of types) {
      if (rows.some((r) => r.type === tp)) continue;
      if (tp === "cloze" && !(first.example && containsTerm(first.example, first.front))) continue;
      if (tp === "collocation" && !first.collocation) continue;
      db.insert(cards)
        .values({ ...first, id: undefined, type: tp, fsrsState: newFsrsState(), dueAt: new Date(), isNew: true, createdAt: new Date() })
        .onConflictDoNothing()
        .run();
    }
  }
  writeIncompleteRequests();
}

export function setSuspended(cardIds: number[], suspended: boolean): void {
  if (!cardIds.length) return;
  getDb().update(cards).set({ suspended }).where(inArray(cards.id, cardIds)).run();
}

export function deleteWord(key: string): void {
  const db = getDb();
  const ids = db.select({ id: cards.id }).from(cards).where(and(eq(cards.subject, currentSubject()), eq(cards.noteKey, key))).all().map((r) => r.id);
  if (ids.length) db.delete(reviews).where(inArray(reviews.cardId, ids)).run();
  db.delete(cards).where(eq(cards.noteKey, key)).run();
  writeIncompleteRequests();
}

/* ---------------- exchange with /szokincs ---------------- */

export const vocabExchange = {
  dir: () => path.join(paths.exchange, "vocab"),
  requests: () => path.join(paths.exchange, "vocab", "incomplete.json"),
  completions: () => path.join(paths.exchange, "vocab", "completions.json"),
};

/** exchange/vocab/incomplete.json: the words /szokincs has to complete. */
export function writeIncompleteRequests(): number {
  const db = getDb();
  const rows = db.select().from(cards).where(and(eq(cards.subject, currentSubject()), eq(cards.incomplete, true))).all();
  const byKey = new Map<string, { key: string; term: string; context: string | null; level: string | null; topic: string | null }>();
  for (const r of rows) if (!byKey.has(r.noteKey)) byKey.set(r.noteKey, { key: r.noteKey, term: r.front, context: r.context, level: r.level, topic: r.topic });
  fs.mkdirSync(vocabExchange.dir(), { recursive: true });
  fs.writeFileSync(
    vocabExchange.requests(),
    JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), words: [...byKey.values()] }, null, 2) + "\n",
    "utf8",
  );
  return byKey.size;
}

export const CompletionsSchema = z.object({
  schemaVersion: z.literal(1),
  words: z.array(
    z.object({
      key: z.string().min(1),
      term: z.string().min(1),
      meaning: z.string().trim().min(1),
      example: z.string().trim().min(1),
      collocation: z.string().optional(),
    }),
  ),
});

/** Applies exchange/vocab/completions.json (written by /szokincs) and archives it. */
export function importVocabCompletions(): { applied: number; errors: string[] } {
  const file = vocabExchange.completions();
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return { applied: 0, errors: [] };
  let parsed;
  try {
    parsed = CompletionsSchema.safeParse(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")));
  } catch (e) {
    return { applied: 0, errors: [`Hibás JSON: ${(e as Error).message}`] };
  }
  if (!parsed.success) return { applied: 0, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  let applied = 0;
  const db = getDb();
  for (const w of parsed.data.words) {
    const exists = db.select({ id: cards.id }).from(cards).where(and(eq(cards.subject, currentSubject()), eq(cards.noteKey, w.key))).get();
    if (!exists) continue;
    db.update(cards).set({ front: w.term }).where(eq(cards.noteKey, w.key)).run();
    updateWord(w.key, { back: w.meaning, example: w.example, collocation: w.collocation ?? null });
    applied++;
  }
  fs.mkdirSync(paths.archive, { recursive: true });
  fs.renameSync(file, path.join(paths.archive, `vocab-completions-${Date.now()}.json`));
  writeIncompleteRequests();
  return { applied, errors: [] };
}

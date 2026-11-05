import type { Item, ObjectiveTask } from "@/lib/content/schema";

/** The marker used for "this line is correct" in error-spotting tasks. */
export const CORRECT_MARKER = "✓";
const CORRECT_MARKER_ALIASES = new Set(["✓", "✔", "√", "ok", "correct", "helyes", "jó", "jo", "v", "-", "–"]);

/**
 * Normalises a free-text answer for comparison: case, surrounding / repeated
 * whitespace, typographic apostrophes and quotes, and trailing sentence
 * punctuation do not count.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw
    .normalize("NFC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/[.!?,;:]+$/g, "").trim();
  s = s.replace(/^["']+|["']+$/g, "").trim();
  if (CORRECT_MARKER_ALIASES.has(s)) return CORRECT_MARKER;
  return s;
}

/** Classic Levenshtein distance (small strings only). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Allowed edit distance for "almost right" (a likely typo). */
export function typoThreshold(expected: string): number {
  if (expected.length <= 3) return 0;
  if (expected.length <= 7) return 1;
  return 2;
}

export type ItemResult = {
  itemId: string;
  correct: boolean;
  /** Close to an accepted answer (probably a spelling mistake) but not accepted. */
  near: boolean;
  given: string;
  /** The canonical correct answer (option key or first accepted text). */
  expected: string;
  /** Human readable correct answer (option text for choices). */
  expectedLabel: string;
  points: number;
  maxPoints: number;
  category: string;
};

export type CheckOptions = {
  /** Count near misses (typos) as correct. Default false (exam behaviour). */
  acceptNearMiss?: boolean;
};

function optionLabel(task: Pick<ObjectiveTask, "options">, item: Item, key: string): string {
  const pool = item.kind === "choice" ? item.options : task.options ?? [];
  const opt = pool.find((o) => o.key === key);
  return opt ? `${key} – ${opt.text}` : key;
}

export function checkItem(
  task: Pick<ObjectiveTask, "options">,
  item: Item,
  givenRaw: string | undefined,
  opts: CheckOptions = {},
): ItemResult {
  const given = (givenRaw ?? "").trim();
  const maxPoints = item.points ?? 1;
  const base = { itemId: item.id, given, maxPoints, category: item.category };

  if (item.kind === "text") {
    const g = normalizeAnswer(given);
    const accepted = item.answer.map(normalizeAnswer);
    const expected = item.answer[0]!;
    let correct = g.length > 0 && accepted.includes(g);
    let near = false;
    if (!correct && g.length > 0 && g !== CORRECT_MARKER) {
      near = accepted.some((a) => a !== CORRECT_MARKER && levenshtein(g, a) <= typoThreshold(a));
      if (near && opts.acceptNearMiss) correct = true;
    }
    return {
      ...base,
      correct,
      near,
      expected,
      expectedLabel: expected === CORRECT_MARKER ? "✓ (a sor helyes)" : item.answer.join(" / "),
      points: correct ? maxPoints : 0,
    };
  }

  // choice / match / tf: compare keys case-insensitively
  const g = given.toUpperCase();
  const correct = g.length > 0 && g === item.answer.toUpperCase();
  const expectedLabel =
    item.kind === "tf" ? item.answer : optionLabel(task, item, item.answer);
  return {
    ...base,
    correct,
    near: false,
    expected: item.answer,
    expectedLabel,
    points: correct ? maxPoints : 0,
  };
}

export type TaskResult = {
  items: ItemResult[];
  score: number;
  maxScore: number;
};

export function scoreTask(
  task: Pick<ObjectiveTask, "options" | "items">,
  answers: Record<string, string | undefined>,
  opts: CheckOptions = {},
): TaskResult {
  const items = task.items.map((item) => checkItem(task, item, answers[item.id], opts));
  const score = items.reduce((s, r) => s + r.points, 0);
  const maxScore = items.reduce((s, r) => s + r.maxPoints, 0);
  return { items, score, maxScore };
}

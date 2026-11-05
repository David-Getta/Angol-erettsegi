import type { Item, ObjectiveTask } from "@/lib/content/schema";

/** The marker used for "this line is correct" in error-spotting tasks. */
export const CORRECT_MARKER = "✓";
const CORRECT_MARKER_ALIASES = new Set(["✓", "✔", "√", "ok", "correct", "helyes", "jó", "jo", "v", "-", "–"]);

/**
 * Normalises a free-text answer for comparison: case, surrounding / repeated
 * whitespace, typographic apostrophes and quotes, and trailing sentence
 * punctuation do not count.
 */
export function normalizeAnswer(raw: string, keepCase = false): string {
  let s = raw
    .normalize("NFC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!keepCase) s = s.toLowerCase();
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/[.!?,;:]+$/g, "").trim();
  s = s.replace(/^["']+|["']+$/g, "").trim();
  if (CORRECT_MARKER_ALIASES.has(s)) return CORRECT_MARKER;
  return s;
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };
const isNumberPart = (w: string) => w in UNITS || w in TENS || w in SCALES;
const isNumberToken = (t: string | undefined) => !!t && t.split("-").every(isNumberPart);

/**
 * Numbers written in words become digits ("two hundred and forty" → "240",
 * "nine people" → "9 people"), so a short answer is right whichever way the
 * student writes the number. Expects an already normalized (lower-case) string.
 */
export function numberWordsToDigits(s: string): string {
  const tokens = s.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let j = i;
    let total = 0;
    let current = 0;
    let used = false;
    let lastWasScale = false;
    while (j < tokens.length) {
      const tok = tokens[j]!;
      if (!used && tok === "a" && tokens[j + 1] && tokens[j + 1]! in SCALES) {
        current = 1;
        j++;
        continue;
      }
      if (used && tok === "and" && lastWasScale && isNumberToken(tokens[j + 1])) {
        j++;
        continue;
      }
      if (!isNumberToken(tok)) break;
      for (const part of tok.split("-")) {
        if (part in UNITS) current += UNITS[part]!;
        else if (part in TENS) current += TENS[part]!;
        else if (part === "hundred") current = (current || 1) * 100;
        else {
          total += (current || 1) * SCALES[part]!;
          current = 0;
        }
        lastWasScale = part in SCALES;
      }
      used = true;
      j++;
    }
    if (used) {
      out.push(String(total + current));
      i = j;
    } else {
      out.push(tokens[i]!);
      i++;
    }
  }
  return out.join(" ");
}

/** Thousands separators in numbers ("5 000", "5.000", "5,000") are dropped: 5000. */
export function joinThousands(s: string): string {
  let prev = "";
  let out = s;
  while (out !== prev) {
    prev = out;
    out = out.replace(/(\d)[ .,](\d{3})(?!\d)/g, "$1$2");
  }
  return out;
}

/**
 * Normalization used when checking an answer: normalizeAnswer + numbers as digits, thousands separators dropped.
 * `decimalComma` (Hungarian notation, non-language subjects): a comma or a dot between digits is a decimal mark
 * (0,5 = 0.5) and only spaces separate thousands (1 000 000).
 */
export function normalizeForCheck(raw: string, opts: { decimalComma?: boolean; caseSensitive?: boolean } = {}): string {
  const s = normalizeAnswer(raw, opts.caseSensitive);
  if (s === CORRECT_MARKER) return s;
  const n = numberWordsToDigits(s);
  if (!opts.decimalComma) return joinThousands(n);
  let out = n.replace(/(\d),(\d)/g, "$1.$2");
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/(\d) (\d{3})(?!\d)/g, "$1$2");
  }
  // spacing around numbers and symbols does not matter: (4; 6) = (4;6), x = 3 = x=3, 20 π = 20π; words keep their spaces
  return out.replace(/\s+(?=[^\p{L}\s])|(?<=[^\p{L}\s])\s+/gu, "");
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
  /** Hungarian number notation (non-language subjects): 0,5 = 0.5, thousands only with spaces. */
  decimalComma?: boolean;
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
    const norm = { decimalComma: opts.decimalComma, caseSensitive: item.caseSensitive };
    const g = normalizeForCheck(given, norm);
    const accepted = item.answer.map((a) => normalizeForCheck(a, norm));
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

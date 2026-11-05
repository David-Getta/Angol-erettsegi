import type { ObjectiveTask, Passage } from "./schema";

/** Text helpers shared by the validator, the seeder and the UI (no Node APIs). */

export const GAP_RE = /\[\[(\d{1,3})\]\]/g;

export function gapIdsInPassage(p: Passage): string[] {
  const ids: string[] = [];
  for (const b of p.blocks) {
    if (b.gap) ids.push(b.gap);
    for (const m of b.text.matchAll(GAP_RE)) ids.push(m[1]!);
  }
  return ids;
}

export function passageText(t: Pick<ObjectiveTask, "passage">): string {
  if (!t.passage) return "";
  return [t.passage.title, ...t.passage.blocks.map((b) => [b.heading, b.text].filter(Boolean).join("\n"))]
    .filter(Boolean)
    .join("\n")
    .replace(GAP_RE, " ");
}

export function scriptText(t: Pick<ObjectiveTask, "listening">): string {
  return t.listening?.script.map((l) => l.text).join("\n") ?? "";
}

/** Lowercase, unified quotes, collapsed whitespace – for substring search. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Word count as in the exam: tokens separated by whitespace; contractions count as one word. */
export function wordCount(text: string): number {
  const tokens = text
    .replace(GAP_RE, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => t.length > 0);
  return tokens.length;
}

/**
 * Finds [start, end) of `needle` in `haystack`, ignoring case and whitespace
 * differences. Returns null if not found. Used for highlighting evidence and
 * corrections.
 */
export function findLoose(haystack: string, needle: string, from = 0): [number, number] | null {
  const n = needle.trim();
  if (!n) return null;
  const exact = haystack.indexOf(n, from);
  if (exact !== -1) return [exact, exact + n.length];
  const lowerIdx = haystack.toLowerCase().indexOf(n.toLowerCase(), from);
  if (lowerIdx !== -1) return [lowerIdx, lowerIdx + n.length];
  // whitespace / quote tolerant search
  const escaped = n
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['\u2019]/g, "['\u2019]"))
    .join("\\s+");
  const re = new RegExp(escaped, "i");
  const m = re.exec(haystack.slice(from));
  if (m) return [from + m.index, from + m.index + m[0].length];
  return null;
}

export type Segment = { text: string; mark?: number };

/**
 * Splits text into segments where the given ranges are marked (by index of the
 * range). Overlapping ranges: the earlier one wins.
 */
export function segmentText(text: string, ranges: Array<[number, number] | null>): Segment[] {
  const list = ranges
    .map((r, i) => (r ? { s: r[0], e: r[1], i } : null))
    .filter((x): x is { s: number; e: number; i: number } => x !== null)
    .sort((a, b) => a.s - b.s);
  const out: Segment[] = [];
  let pos = 0;
  for (const r of list) {
    if (r.s < pos) continue;
    if (r.s > pos) out.push({ text: text.slice(pos, r.s) });
    out.push({ text: text.slice(r.s, r.e), mark: r.i });
    pos = r.e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Locates each phrase in order (later occurrences after earlier ones when possible). */
export function locateAll(text: string, phrases: string[]): Array<[number, number] | null> {
  const used: Array<[number, number]> = [];
  return phrases.map((p) => {
    let from = 0;
    let found = findLoose(text, p, from);
    while (found && used.some((u) => u[0] === found![0])) {
      from = found[1];
      found = findLoose(text, p, from);
    }
    if (!found) found = findLoose(text, p, 0);
    if (found) used.push(found);
    return found;
  });
}

/**
 * The sentence around gap [[id]] with the gap shown as ___ (or the item prompt).
 * Used as context in the error log and in targeted practice.
 */
export function itemContext(
  t: Pick<ObjectiveTask, "passage" | "items" | "example">,
  itemId: string,
): string {
  const item = [t.example, ...t.items].find((i) => i.id === itemId);
  if (item?.prompt) return item.kind === "text" && item.cue ? `${item.prompt} (${item.cue})` : item.prompt;
  if (!t.passage) return "";
  const marker = `[[${itemId}]]`;
  for (const b of t.passage.blocks) {
    if (b.gap === itemId) {
      const first = b.text.replace(GAP_RE, "___").split(/(?<=[.!?])\s+/)[0] ?? "";
      return `___ ${first}`;
    }
    const idx = b.text.indexOf(marker);
    if (idx === -1) continue;
    const sentences = b.text.split(/(?<=[.!?]['’”]?)\s+(?=[A-Z"“‘'(])/);
    const hit = sentences.find((s) => s.includes(marker)) ?? b.text;
    const cue = item?.kind === "text" && item.cue ? ` (${item.cue})` : "";
    return hit
      .replace(marker, `___${cue}`)
      .replace(GAP_RE, (_m, id: string) => {
        const other = [t.example, ...t.items].find((i) => i.id === id);
        return other?.kind === "text" ? other.answer[0]! : "…";
      })
      .trim();
  }
  return "";
}

/**
 * English phrases quoted „like this” in Hungarian notes. With `sourceText`
 * only phrases that occur in it are kept (that filters out Hungarian quotes);
 * elided quotes (…) and very long ones are skipped.
 */
export function quotedPhrases(notes: string[], sourceText?: string): string[] {
  const source = sourceText ? normalizeForSearch(sourceText) : null;
  const out: string[] = [];
  for (const n of notes) {
    for (const m of n.matchAll(/„([^”]{2,60})”/g)) {
      const p = m[1]!.trim().replace(/[.,;:!?]+$/, "");
      if (!p || p.includes("…") || p.includes("...") || !/[a-z]/i.test(p) || /[áéíóöőúüű]/i.test(p)) continue;
      if (source && !source.includes(normalizeForSearch(p))) continue;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out.slice(0, 8);
}

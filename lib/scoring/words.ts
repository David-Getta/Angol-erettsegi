import { numberWordsToDigits } from "@/lib/scoring/check";

/** Word-level comparison of a typed sentence with the original (dictation). Client-safe. */

export type DiffToken = { word: string; status: "ok" | "missing" | "wrong" | "extra"; typed?: string };

/** One word for comparison: lower case, unified apostrophes, no surrounding punctuation, number words as digits. */
const norm = (w: string) =>
  numberWordsToDigits(
    w
      .toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'")
      .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""),
  );

/**
 * Compares the typed sentence with the original word by word (LCS): every
 * original word is ok / missing / wrong (a different word in its place),
 * typed words with no counterpart are extra.
 */
export function compareWords(original: string, typed: string): { tokens: DiffToken[]; correct: number; total: number } {
  const a = original.split(/\s+/).filter(Boolean);
  const b = typed.split(/\s+/).filter(Boolean);
  const na = a.map(norm);
  const nb = b.map(norm);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = na[i] === nb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  const pendingTyped: string[] = [];
  const flushAgainst = (word: string) => {
    if (pendingTyped.length) tokens.push({ word, status: "wrong", typed: pendingTyped.splice(0).join(" ") });
    else tokens.push({ word, status: "missing" });
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && na[i] === nb[j]) {
      for (const x of pendingTyped.splice(0)) tokens.push({ word: x, status: "extra" });
      tokens.push({ word: a[i]!, status: "ok" });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
      pendingTyped.push(b[j]!);
      j++;
    } else {
      flushAgainst(a[i]!);
      i++;
    }
  }
  for (const x of pendingTyped) tokens.push({ word: x, status: "extra" });
  const total = a.length;
  const correct = tokens.filter((x) => x.status === "ok").length;
  return { tokens, correct, total };
}

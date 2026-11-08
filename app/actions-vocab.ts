"use server";

import { revalidatePath } from "next/cache";
import { addDeck, addFixCard, addWord, deleteWord, reviewCard, setSuspended, updateWord, importVocabCompletions, clozeFor } from "@/lib/vocab/cards";
import { previewIntervals, type StoredFsrs } from "@/lib/vocab/fsrs";

export async function addDeckAction(deckId: string) {
  const n = addDeck(deckId);
  revalidatePath("/szokincs");
  return n;
}

export async function addManualWordAction(input: { term: string; meaning: string; example?: string; collocation?: string }) {
  const r = addWord({ term: input.term, meaning: input.meaning || null, example: input.example || null, collocation: input.collocation || null, sourceType: "manual" });
  revalidatePath("/szokincs");
  return r;
}

export async function updateWordAction(key: string, patch: { back?: string; example?: string | null; collocation?: string | null }) {
  updateWord(key, patch);
  revalidatePath("/szokincs");
}

export async function deleteWordAction(key: string) {
  deleteWord(key);
  revalidatePath("/szokincs");
}

export async function suspendAction(ids: number[], suspended: boolean) {
  setSuspended(ids, suspended);
  revalidatePath("/szokincs");
}

export async function reviewCardAction(cardId: number, rating: 1 | 2 | 3 | 4, durationMs: number) {
  const c = reviewCard(cardId, rating, durationMs);
  return { id: c.id, dueAt: c.dueAt.toISOString(), previews: previewIntervals(c.fsrsState as StoredFsrs), cloze: c.example ? clozeFor(c.example, c.front) : null };
}

export async function importVocabAction() {
  const r = importVocabCompletions();
  revalidatePath("/szokincs");
  return r;
}

/** Adds a correction (error log row or grading correction) to the FSRS review as a "fix" card. */
export async function addFixCardAction(input: { original: string; corrected: string; explanation: string; context?: string | null; sourceType: string; sourceId?: string | null }) {
  const r = addFixCard(input);
  revalidatePath("/szokincs");
  return r;
}

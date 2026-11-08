"use server";

import { revalidatePath } from "next/cache";
import {
  applyPastedFeedback,
  createSubmission,
  deleteSubmission,
  getSubmission,
  gradingPromptFor,
  importOutbox,
  type CreateSubmissionInput,
} from "@/lib/submissions";
import { importVocabCompletions, addWord } from "@/lib/vocab/cards";
import { listOutbox } from "@/lib/exchange/files";
import { getTaskRow } from "@/lib/tasks";

export async function createSubmissionAction(input: CreateSubmissionInput) {
  try {
    const sub = createSubmission(input);
    revalidatePath("/", "layout");
    return { ok: true as const, id: sub.id };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function importFeedbackAction() {
  const vocab = importVocabCompletions();
  const nothing = listOutbox().length === 0;
  const r = nothing ? { imported: [], failed: [], warnings: [] } : importOutbox();
  revalidatePath("/", "layout");
  return { ...r, nothing, vocabApplied: vocab.applied, vocabErrors: vocab.errors };
}

export async function pasteFeedbackAction(submissionId: string, text: string) {
  const r = applyPastedFeedback(submissionId, text);
  if (r.ok) revalidatePath("/", "layout");
  return r.ok ? { ok: true as const, warnings: r.warnings } : { ok: false as const, errors: r.errors };
}

export async function gradingPromptAction(submissionId: string) {
  const sub = getSubmission(submissionId);
  if (!sub) throw new Error("Ismeretlen beadás.");
  return gradingPromptFor(sub);
}

export async function deleteSubmissionAction(submissionId: string) {
  deleteSubmission(submissionId);
  revalidatePath("/", "layout");
}

export async function addPhrasesAction(submissionId: string, phrases: { en: string; hu: string; example?: string }[]) {
  const sub = getSubmission(submissionId);
  const task = sub ? getTaskRow(sub.taskId) : undefined;
  let created = 0;
  for (const p of phrases) {
    created += addWord({
      term: p.en,
      meaning: p.hu,
      example: p.example ?? null,
      sourceType: sub?.kind ?? "writing",
      sourceId: submissionId,
      topic: task?.topic ?? null,
      level: task?.level ?? null,
    }).created;
  }
  return created;
}

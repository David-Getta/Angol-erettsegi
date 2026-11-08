"use server";

import { revalidatePath } from "next/cache";
import { saveAttempt, type AttemptMode } from "@/lib/attempts";
import { addWord } from "@/lib/vocab/cards";
import { getTaskRow } from "@/lib/tasks";
import { checkTargetedItem, logTargetedTime } from "@/lib/targeted";
import { logActivity } from "@/lib/activity";
import { checkLessonItem } from "@/lib/lessons";

export async function saveAttemptAction(input: {
  taskId: string;
  mode: AttemptMode;
  answers: Record<string, string>;
  durationSec: number;
  mockExamId?: number | null;
}) {
  const { attempt, result } = saveAttempt(input);
  revalidatePath("/", "layout");
  return { attemptId: attempt.id, score: result.score, maxScore: result.maxScore, items: result.items };
}

export async function addWordCardAction(input: {
  term: string;
  meaning?: string | null;
  example?: string | null;
  collocation?: string | null;
  context?: string | null;
  taskId?: string | null;
  sourceType: string;
}) {
  const task = input.taskId ? getTaskRow(input.taskId) : undefined;
  const r = addWord({
    term: input.term,
    meaning: input.meaning ?? null,
    example: input.example ?? null,
    collocation: input.collocation ?? null,
    context: input.context ?? null,
    sourceType: input.sourceType,
    sourceId: input.taskId ?? null,
    topic: task?.topic ?? null,
    level: task?.level ?? null,
  });
  return r;
}

export async function checkTargetedAction(key: string, given: string) {
  return checkTargetedItem(key, given);
}

export async function logTargetedTimeAction(seconds: number, section = "language-use") {
  logTargetedTime(seconds, section);
  revalidatePath("/hibanaplo");
}

/** Checks one self-check item of a Szabálytár lesson (scored on the server). */
export async function checkLessonItemAction(input: { category: string; itemId: string; answer: string; seconds?: number }) {
  return checkLessonItem(input.category, input.itemId, input.answer, input.seconds ?? 0);
}

/** Practice time of a dictation round (counts as listening). */
export async function logDictationTimeAction(seconds: number) {
  logActivity("listening", seconds);
}

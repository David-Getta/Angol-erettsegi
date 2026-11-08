"use server";

import { revalidatePath } from "next/cache";
import { abandonMock, setPartExcluded, startMock, startPart, submitPart, type MockKind } from "@/lib/mock";
import type { PartId } from "@/lib/exam/config";
import { getSettings } from "@/lib/settings";

export async function startMockAction(kind: MockKind) {
  const r = startMock(kind, getSettings().level);
  revalidatePath("/", "layout");
  return r;
}

export async function startPartAction(id: number) {
  startPart(id);
  revalidatePath("/", "layout");
}

export async function submitPartAction(id: number, partIndex: number, answers: Record<string, Record<string, string>>, writing: Record<string, string>, durationSec: number) {
  const m = submitPart(id, partIndex, answers, writing, durationSec);
  revalidatePath("/", "layout");
  return { status: m.status, currentPart: m.currentPart };
}

export async function abandonMockAction(id: number) {
  abandonMock(id);
  revalidatePath("/", "layout");
}

/** Leaves a part of a finished diagnostic out of the result (e.g. unusable listening audio), or counts it again. */
export async function setPartExcludedAction(id: number, part: PartId, exclude: boolean) {
  setPartExcluded(id, part, exclude);
  revalidatePath("/", "layout");
}

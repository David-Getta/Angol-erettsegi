import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import type { Guide } from "@/lib/content/schema";
import { getContent } from "@/lib/tasks";
import { contentIdPrefix, currentSubject } from "@/lib/exam/config";

/** Útmutatók: guides for writing text types, speaking task types and exam parts (content/guide/kozep/gd-<type>-<target>.json). */

export type GuideKind = Guide["type"];
/** Guide id in the current subject (angol: gd-exam-reading, matematika: mat-gd-exam-reading). */
export const guideId = (type: GuideKind, target: string, subjectId?: string) => `${contentIdPrefix(subjectId)}gd-${type}-${target}`;

export function listGuides(): Guide[] {
  return getDb()
    .select({ content: tasks.content })
    .from(tasks)
    .where(and(eq(tasks.subject, currentSubject()), eq(tasks.section, "guide"), eq(tasks.active, true)))
    .all()
    .map((r) => r.content as Guide);
}

export function getGuide(id: string): Guide | null {
  const g = getContent<Guide>(id);
  return g && g.section === "guide" ? g : null;
}

/** The guide id for a writing/speaking task type or exam part, if such a guide exists. */
export function guideFor(type: GuideKind, target: string): string | null {
  const id = guideId(type, target);
  const row = getDb().select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.active, true))).get();
  return row ? id : null;
}

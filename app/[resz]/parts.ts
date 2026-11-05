import { notFound } from "next/navigation";
import { partBySlug, type ExamPart } from "@/lib/exam/config";
import { getSettings } from "@/lib/settings";

/** Resolves a URL segment to an exam part of the current subject, or 404. */
export function resolvePart(slug: string): ExamPart {
  const part = partBySlug(slug, getSettings().level) ?? partBySlug(slug);
  if (!part) notFound();
  return part;
}

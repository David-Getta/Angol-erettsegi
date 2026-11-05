import crypto from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { errors, submissions, type SubmissionRow } from "@/lib/db/schema";
import type { Level, SpeakingTask, WritingTask } from "@/lib/content/schema";
import { wordCount } from "@/lib/content/text";
import { examConfig } from "@/lib/exam/config";
import { getContent, getTaskRow } from "@/lib/tasks";
import { setMeta, getMeta } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import {
  speakingGoalIds,
  speakingGradingPrompt,
  speakingRubricRef,
  type PromptSubject,
  writingGradingPrompt,
  writingRubricRef,
  type RubricRef,
} from "@/lib/exchange/prompts";
import { FeedbackSchema, describeIssues, extractJson, parseFeedbackText, type Feedback, type SubmissionFile } from "@/lib/exchange/schema";
import { archiveExchange, listOutbox, readOutboxText, removeInboxFile, writeInboxFile } from "@/lib/exchange/files";
import { configFor, currentSubject, subject } from "@/lib/exam/config";

export type SubmissionMode = "practice" | "exam" | "mock" | "diagnostic";

function newId(kind: "writing" | "speaking"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${kind === "writing" ? "w" : "s"}-${stamp}-${crypto.randomBytes(2).toString("hex")}`;
}

/** The rubric for a task: writing by task number, speaking by task type (interview, situation, debate …). */
export function rubricRefFor(kind: "writing" | "speaking", level: Level, task: { taskNumber?: number; type?: string } | null, subjectId: string = currentSubject()): RubricRef {
  const cfg = configFor(subjectId);
  return kind === "writing"
    ? writingRubricRef(cfg.writingRubric(level), task?.taskNumber ?? 1, subjectId)
    : speakingRubricRef(cfg.speakingRubric(level), task?.type ?? "interview", subjectId);
}

function promptSubject(id: string): PromptSubject {
  const s = subject(id);
  return { id: s.id, name: s.name, language: s.language };
}

/** Builds the grading prompt for a stored submission (used for inbox files and the copy button). */
export function gradingPromptFor(sub: SubmissionRow): string {
  const task = getContent(sub.taskId);
  if (!task) throw new Error(`Ismeretlen feladat: ${sub.taskId}`);
  const cfg = configFor(sub.subject);
  const categories = cfg.errorCategories().categories;
  const level = sub.level as Level;
  if (sub.kind === "writing") {
    const parent = sub.parentId ? getSubmission(sub.parentId) : null;
    return writingGradingPrompt({
      submissionId: sub.id,
      level,
      task: task as WritingTask,
      rubric: cfg.writingRubric(level),
      text: sub.text,
      wordCount: sub.wordCount,
      categories,
      subject: promptSubject(sub.subject),
      previous: parent ? { text: parent.text, score: parent.score, maxScore: parent.maxScore } : null,
    });
  }
  return speakingGradingPrompt({
    submissionId: sub.id,
    level,
    task: task as SpeakingTask,
    rubric: cfg.speakingRubric(level),
    text: sub.text,
    wordCount: sub.wordCount,
    transcriptSource: sub.transcriptSource,
    categories,
    subject: promptSubject(sub.subject),
  });
}

export type CreateSubmissionInput = {
  kind: "writing" | "speaking";
  taskId: string;
  text: string;
  mode: SubmissionMode;
  durationSec: number;
  parentId?: string | null;
  transcriptSource?: "app-asr" | "claude-voice" | "typed" | null;
  mockExamId?: number | null;
};

export function createSubmission(input: CreateSubmissionInput): SubmissionRow {
  const db = getDb();
  const taskRow = getTaskRow(input.taskId);
  if (!taskRow) throw new Error(`Ismeretlen feladat: ${input.taskId}`);
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (!text) throw new Error("Üres szöveget nem lehet beadni.");
  const parent = input.parentId ? getSubmission(input.parentId) : null;
  const level = taskRow.level as Level;
  const content = taskRow.content as WritingTask | SpeakingTask;
  const ref = rubricRefFor(input.kind, level, content, taskRow.subject);
  const id = newId(input.kind);
  const row: typeof submissions.$inferInsert = {
    id,
    subject: taskRow.subject,
    kind: input.kind,
    taskId: input.taskId,
    level,
    text,
    version: parent ? parent.version + 1 : 1,
    parentId: parent?.id ?? null,
    rootId: parent?.rootId ?? id,
    status: "pending",
    mode: input.mode,
    durationSec: Math.max(0, Math.round(input.durationSec)),
    wordCount: wordCount(text),
    transcriptSource: input.kind === "speaking" ? input.transcriptSource ?? "typed" : null,
    mockExamId: input.mockExamId ?? null,
    createdAt: new Date(),
  };
  db.insert(submissions).values(row).run();
  const saved = getSubmission(id)!;

  const file: SubmissionFile = {
    schemaVersion: 1,
    id,
    kind: input.kind,
    createdAt: saved.createdAt.toISOString(),
    level,
    mode: input.mode,
    version: saved.version,
    parentId: saved.parentId,
    subject: taskRow.subject,
    rubric: { file: ref.file, id: ref.id, taskNumber: ref.taskNumber },
    task: {
      id: taskRow.id,
      title: taskRow.title,
      type: taskRow.type,
      topic: taskRow.topic,
      source: taskRow.source as "official" | "generated",
      // model / sample answers stay out of the grading material so they cannot anchor the score
      card: Object.fromEntries(Object.entries(content).filter(([k]) => k !== "modelAnswer" && k !== "sampleAnswer")),
    },
    text,
    wordCount: saved.wordCount,
    durationSec: saved.durationSec,
    transcriptSource: saved.transcriptSource as SubmissionFile["transcriptSource"],
    previousVersion: parent ? { id: parent.id, text: parent.text, score: parent.score, maxScore: parent.maxScore } : null,
    instructions: gradingPromptFor(saved),
  };
  writeInboxFile(file);
  if (saved.durationSec > 0) logActivity(input.kind, saved.durationSec);
  return saved;
}

export function getSubmission(id: string): SubmissionRow | undefined {
  return getDb().select().from(submissions).where(eq(submissions.id, id)).get();
}

export function listSubmissions(kind?: "writing" | "speaking", status?: "pending" | "graded"): SubmissionRow[] {
  const conds = [];
  if (kind) conds.push(eq(submissions.kind, kind));
  if (status) conds.push(eq(submissions.status, status));
  return getDb()
    .select()
    .from(submissions)
    .where(and(eq(submissions.subject, currentSubject()), ...conds))
    .orderBy(desc(submissions.createdAt))
    .all();
}

/** All versions of a rewrite chain, oldest first. */
export function versionsOf(rootId: string): SubmissionRow[] {
  return getDb().select().from(submissions).where(eq(submissions.rootId, rootId)).orderBy(asc(submissions.version)).all();
}

export function deleteSubmission(id: string): void {
  const db = getDb();
  db.delete(errors).where(and(eq(errors.sourceId, id), inArray(errors.sourceType, ["writing", "speaking"]))).run();
  db.delete(submissions).where(eq(submissions.id, id)).run();
  removeInboxFile(id);
}

export type ApplyResult = { ok: true; submission: SubmissionRow; warnings: string[] } | { ok: false; errors: string[] };

/**
 * Validates feedback against the submission's rubric and stores it: status
 * graded, scores, and every correction into the error log (idempotent).
 */
export function applyFeedback(fb: Feedback, opts: { gradedBy?: "claude-code" | "claude-app"; rawJson?: string } = {}): ApplyResult {
  const db = getDb();
  const sub = getSubmission(fb.submissionId);
  if (!sub) return { ok: false, errors: [`Nincs ilyen beadás: ${fb.submissionId}`] };
  if (sub.kind !== fb.kind) return { ok: false, errors: [`A javítás típusa (${fb.kind}) nem egyezik a beadáséval (${sub.kind}).`] };
  const task = getContent(sub.taskId) as WritingTask | SpeakingTask | null;
  const ref = rubricRefFor(sub.kind as "writing" | "speaking", sub.level as Level, task, sub.subject);
  const problems: string[] = [];
  const warnings: string[] = [];
  if (fb.rubricId !== ref.id) problems.push(`A rubricId "${fb.rubricId}", de ennél a beadásnál "${ref.id}" kell.`);
  for (const c of ref.criteria) {
    const got = fb.criteria.find((x) => x.id === c.id);
    if (!got) problems.push(`Hiányzik a(z) "${c.id}" (${c.name}) szempont pontszáma.`);
    else if (got.max !== c.max) problems.push(`A(z) "${c.id}" szempont maximuma ${c.max}, nem ${got.max}.`);
  }
  for (const c of fb.criteria) if (!ref.criteria.some((x) => x.id === c.id)) problems.push(`Ismeretlen szempont: "${c.id}".`);
  const cats = new Set(configFor(sub.subject).errorCategories().categories.map((c) => c.id));
  fb.corrections.forEach((c, i) => {
    if (!cats.has(c.category)) problems.push(`corrections → ${i + 1}. elem: ismeretlen hibakategória "${c.category}".`);
    if (!sub.text.toLowerCase().includes(c.original.trim().toLowerCase())) {
      warnings.push(`A(z) ${i + 1}. javítás eredeti része nem található szó szerint a szövegben: "${c.original}".`);
    }
  });
  if (task) {
    const expectedPoints = sub.kind === "writing" ? (task as WritingTask).points.map((p) => p.id) : speakingGoalIds(task as SpeakingTask);
    const missing = expectedPoints.filter((id) => !fb.taskPoints.some((p) => p.id === id));
    if (missing.length) warnings.push(`Nincs értékelve ez(ek) az irányítási pont(ok): ${missing.join(", ")}.`);
  }
  if (problems.length) return { ok: false, errors: problems };

  const gradedBy = opts.gradedBy ?? fb.gradedBy;
  db.transaction((tx) => {
    tx.update(submissions)
      .set({
        status: "graded",
        feedback: { ...fb, gradedBy, gradedAt: fb.gradedAt ?? new Date().toISOString() },
        score: fb.totalScore,
        maxScore: fb.maxScore,
        gradedBy,
        gradedAt: new Date(),
      })
      .where(eq(submissions.id, sub.id))
      .run();
    tx.delete(errors).where(and(eq(errors.sourceId, sub.id), eq(errors.sourceType, sub.kind))).run();
    for (const c of fb.corrections) {
      tx.insert(errors)
        .values({
          subject: sub.subject,
          category: c.category,
          original: c.original,
          corrected: c.corrected,
          explanation: c.explanation,
          context: null,
          sourceType: sub.kind,
          sourceId: sub.id,
          taskId: sub.taskId,
          createdAt: new Date(),
        })
        .run();
    }
  });
  archiveExchange(sub.id, opts.rawJson);
  setMeta("lastFeedbackImport", { at: new Date().toISOString(), submissionId: sub.id });
  return { ok: true, submission: getSubmission(sub.id)!, warnings };
}

/** Pasted JSON from the Claude app. The submission id is filled in when missing. */
export function applyPastedFeedback(submissionId: string, text: string): ApplyResult {
  const parsed = parseFeedbackText(text);
  if (!parsed.ok) {
    // allow a missing / different submissionId: patch it in and retry
    try {
      const json = extractJson(text);
      if (json) {
        const obj = JSON.parse(json);
        if (obj && typeof obj === "object" && obj.submissionId !== submissionId) {
          obj.submissionId = submissionId;
          const retry = FeedbackSchema.safeParse(obj);
          if (retry.success) return applyFeedback(retry.data, { gradedBy: "claude-app", rawJson: JSON.stringify(obj, null, 2) });
          return { ok: false, errors: describeIssues(retry.error) };
        }
      }
    } catch {
      /* fall through */
    }
    return { ok: false, errors: parsed.errors };
  }
  const fb = { ...parsed.data, submissionId };
  return applyFeedback(fb, { gradedBy: "claude-app", rawJson: JSON.stringify(fb, null, 2) });
}

export type ImportReport = { imported: string[]; failed: Array<{ id: string; errors: string[] }>; warnings: string[] };

/** Reads every exchange/outbox/*.json and applies it. */
export function importOutbox(): ImportReport {
  const report: ImportReport = { imported: [], failed: [], warnings: [] };
  for (const id of listOutbox()) {
    const raw = readOutboxText(id);
    const parsed = parseFeedbackText(raw);
    if (!parsed.ok) {
      report.failed.push({ id, errors: parsed.errors });
      continue;
    }
    if (parsed.data.submissionId !== id) {
      report.failed.push({ id, errors: [`A fájlnév (${id}) és a submissionId (${parsed.data.submissionId}) nem egyezik.`] });
      continue;
    }
    const res = applyFeedback(parsed.data, { gradedBy: parsed.data.gradedBy ?? "claude-code" });
    if (res.ok) {
      report.imported.push(id);
      report.warnings.push(...res.warnings.map((w) => `${id}: ${w}`));
    } else report.failed.push({ id, errors: res.errors });
  }
  setMeta("lastImportRun", { at: new Date().toISOString(), imported: report.imported.length, failed: report.failed.length });
  return report;
}

export function lastImportAt(): string | null {
  return getMeta<{ at: string }>("lastFeedbackImport")?.at ?? null;
}

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { attempts, errors, mockExams, submissions, tasks, type MockExamRow } from "@/lib/db/schema";
import type { Level, WritingTask } from "@/lib/content/schema";
import { examConfig, levelStructure, part as partDef, type PartId, WRITTEN_PARTS } from "@/lib/exam/config";
import { convertToExamPoints, examOutcome, totalPercent, type ExamOutcome, type PartScore } from "@/lib/scoring/exam";
import { writingPartPoints } from "@/lib/scoring/writing";
import { saveAttempt } from "@/lib/attempts";
import { createSubmission } from "@/lib/submissions";
import { usedTaskIds } from "@/lib/tasks";
import { estimateParts } from "@/lib/dashboard";
import { getSettings } from "@/lib/settings";
import { scriptText, wordCount } from "@/lib/content/text";
import type { ObjectiveTask } from "@/lib/content/schema";

export type MockKind = "mock" | "diagnostic";
export type MockPart = { part: PartId; name: string; timeSec: number; taskIds: string[] };
export type MockPlan = { parts: MockPart[] };

/** Diagnostic: one short task per written part (about 45 minutes in total). */
const DIAGNOSTIC: Record<string, { count: number; minutes: number }> = {
  reading: { count: 1, minutes: 12 },
  "language-use": { count: 1, minutes: 8 },
  listening: { count: 1, minutes: 10 },
  writing: { count: 1, minutes: 15 },
};

type Candidate = { id: string; reserved: string | null; content: unknown };

function candidates(section: string, level: Level): Candidate[] {
  return getDb()
    .select({ id: tasks.id, reserved: tasks.reservedFor, content: tasks.content })
    .from(tasks)
    .where(and(eq(tasks.section, section), eq(tasks.level, level), eq(tasks.active, true)))
    .all();
}

/** Unused tasks first: reserved for this kind, then free ones, then the ones reserved for the other kind. */
function pick(list: Candidate[], count: number, kind: MockKind, used: Set<string>): string[] {
  const unused = list.filter((c) => !used.has(c.id));
  const rank = (c: Candidate) => (c.reserved === kind ? 0 : c.reserved === null ? 1 : 2);
  const sorted = [...unused].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  return sorted.slice(0, count).map((c) => c.id);
}

/** Estimated length of a listening task: prep + two plays at the TTS rate + pauses. */
export function listeningSeconds(task: ObjectiveTask | undefined, level: Level): number {
  if (!task?.listening) return 0;
  const ls = levelStructure(level).listening ?? { plays: 2, prepSeconds: 60, pauseSeconds: 30 };
  const rate = getSettings().ttsRate;
  const words = wordCount(scriptText(task));
  const play = (words / (155 * rate)) * 60 + task.listening.script.length * 0.25;
  const plays = task.listening.plays ?? ls.plays;
  return Math.round((task.listening.prepSeconds ?? ls.prepSeconds) + plays * play + plays * (task.listening.pauseSeconds ?? ls.pauseSeconds));
}

export type PlanCheck = { ok: true; plan: MockPlan } | { ok: false; missing: { part: PartId; name: string; need: number; have: number }[] };

export function buildPlan(kind: MockKind, level: Level): PlanCheck {
  const used = usedTaskIds();
  const st = levelStructure(level);
  const missing: { part: PartId; name: string; need: number; have: number }[] = [];
  const parts: MockPart[] = [];
  for (const id of WRITTEN_PARTS) {
    const p = st.parts.find((x) => x.id === id)!;
    const list = candidates(id, level);
    let taskIds: string[];
    let need: number;
    if (id === "writing") {
      const byNumber = (n: number) => list.filter((c) => (c.content as WritingTask).taskNumber === n);
      if (kind === "diagnostic") {
        need = 1;
        taskIds = pick(byNumber(1), 1, kind, used);
      } else {
        need = 2;
        taskIds = [...pick(byNumber(1), 1, kind, used), ...pick(byNumber(2), 1, kind, used)];
      }
    } else {
      need = kind === "diagnostic" ? DIAGNOSTIC[id]!.count : p.mockTaskCount ?? 3;
      taskIds = pick(list, need, kind, used);
    }
    if (taskIds.length < need) missing.push({ part: id, name: p.name, need, have: taskIds.length });
    let timeSec = kind === "diagnostic" ? DIAGNOSTIC[id]!.minutes * 60 : (p.timeMin ?? 30) * 60;
    if (id === "listening") {
      // the recordings are read by TTS: never let the part end before they can be heard twice
      const audio = taskIds.reduce((n, tid) => n + listeningSeconds(list.find((c) => c.id === tid)?.content as ObjectiveTask, level), 0);
      timeSec = Math.max(timeSec, audio + 120);
    }
    parts.push({ part: id, name: p.name, timeSec, taskIds });
  }
  return missing.length ? { ok: false, missing } : { ok: true, plan: { parts } };
}

/** Number of complete, still unused sets per level (for the mock exam landing page). */
export function availableSets(level: Level): number {
  const used = usedTaskIds();
  const st = levelStructure(level);
  let sets = Infinity;
  for (const id of WRITTEN_PARTS) {
    const p = st.parts.find((x) => x.id === id)!;
    const list = candidates(id, level).filter((c) => !used.has(c.id));
    if (id === "writing") {
      const n1 = list.filter((c) => (c.content as WritingTask).taskNumber === 1).length;
      const n2 = list.filter((c) => (c.content as WritingTask).taskNumber === 2).length;
      sets = Math.min(sets, n1, n2);
    } else sets = Math.min(sets, Math.floor(list.length / (p.mockTaskCount ?? 3)));
  }
  return sets === Infinity ? 0 : sets;
}

export function getMock(id: number): MockExamRow | undefined {
  return getDb().select().from(mockExams).where(eq(mockExams.id, id)).get();
}

export function activeMock(kind: MockKind, level: Level): MockExamRow | undefined {
  return getDb()
    .select()
    .from(mockExams)
    .where(and(eq(mockExams.kind, kind), eq(mockExams.level, level), eq(mockExams.status, "in-progress")))
    .orderBy(desc(mockExams.createdAt))
    .get();
}

export function listMocks(kind: MockKind, level?: Level): MockExamRow[] {
  return getDb()
    .select()
    .from(mockExams)
    .where(level ? and(eq(mockExams.kind, kind), eq(mockExams.level, level)) : eq(mockExams.kind, kind))
    .orderBy(desc(mockExams.createdAt))
    .all();
}

export function startMock(kind: MockKind, level: Level): { ok: true; id: number } | { ok: false; missing: { part: PartId; name: string; need: number; have: number }[] } {
  const existing = activeMock(kind, level);
  if (existing) return { ok: true, id: existing.id };
  const plan = buildPlan(kind, level);
  if (!plan.ok) return plan;
  const row = getDb()
    .insert(mockExams)
    .values({ kind, level, status: "in-progress", plan: plan.plan, currentPart: 0, partStartedAt: null, createdAt: new Date() })
    .returning()
    .get();
  return { ok: true, id: row.id };
}

export function startPart(id: number): void {
  const m = getMock(id);
  if (!m || m.status !== "in-progress" || m.partStartedAt) return;
  getDb().update(mockExams).set({ partStartedAt: new Date() }).where(eq(mockExams.id, id)).run();
}

/** Seconds left in the current part (server clock). */
export function secondsLeft(m: MockExamRow, now: Date = new Date()): number | null {
  const plan = m.plan as MockPlan;
  const p = plan.parts[m.currentPart];
  if (!p || !m.partStartedAt) return null;
  return Math.max(0, Math.round((m.partStartedAt.getTime() + p.timeSec * 1000 - now.getTime()) / 1000));
}

/**
 * Closes the current part: saves the answers (attempts / submissions) and
 * moves on. There is no way back to a closed part.
 */
export function submitPart(
  id: number,
  partIndex: number,
  answers: Record<string, Record<string, string>>,
  writing: Record<string, string>,
  durationSec: number,
): MockExamRow {
  const m = getMock(id);
  if (!m) throw new Error("Ismeretlen próbaérettségi.");
  if (m.status !== "in-progress" || m.currentPart !== partIndex) return m; // already closed
  const plan = m.plan as MockPlan;
  const p = plan.parts[partIndex]!;
  const kind = m.kind as MockKind;
  const perTask = Math.round(durationSec / Math.max(1, p.taskIds.length));
  if (p.part === "writing") {
    for (const taskId of p.taskIds) {
      const text = (writing[taskId] ?? "").trim();
      if (text) createSubmission({ kind: "writing", taskId, text, mode: kind, durationSec: perTask, mockExamId: id });
    }
  } else {
    for (const taskId of p.taskIds) saveAttempt({ taskId, mode: kind, answers: answers[taskId] ?? {}, durationSec: perTask, mockExamId: id });
  }
  const next = partIndex + 1;
  const finished = next >= plan.parts.length;
  getDb()
    .update(mockExams)
    .set({ currentPart: next, partStartedAt: null, status: finished ? "awaiting-writing" : "in-progress", finishedAt: finished ? new Date() : null })
    .where(eq(mockExams.id, id))
    .run();
  if (finished) refreshMockResult(id);
  return getMock(id)!;
}

export function abandonMock(id: number): void {
  getDb().update(mockExams).set({ status: "abandoned", finishedAt: new Date() }).where(eq(mockExams.id, id)).run();
}

export type MockPartResult = { part: PartId; name: string; raw: number | null; rawMax: number; points: number | null; maxPoints: number; pct: number | null; pending: boolean; estimated?: boolean };

export type MockResult = {
  parts: MockPartResult[];
  writtenPoints: number;
  writtenMax: number;
  writtenPct: number;
  complete: boolean;
  outcome: ExamOutcome;
  oralEstimate: { points: number; source: "speaking" | "written" };
  cefr?: string;
  strengths?: string[];
  weaknesses?: string[];
};

function cefrFor(level: Level, pct: number): string {
  // diagnostic: rough CEFR estimate from the level of the tasks and the score
  if (level === "emelt") return pct >= 80 ? "B2+ / C1" : pct >= 60 ? "B2" : pct >= 40 ? "B1+" : pct >= 25 ? "B1" : "A2–B1";
  return pct >= 80 ? "B1+ / B2" : pct >= 60 ? "B1" : pct >= 40 ? "A2+" : pct >= 25 ? "A2" : "A1–A2";
}

/** Computes (and stores) the result from the saved attempts and submissions. */
export function refreshMockResult(id: number): MockResult | null {
  const m = getMock(id);
  if (!m) return null;
  const db = getDb();
  const level = m.level as Level;
  const kind = m.kind as MockKind;
  const plan = m.plan as MockPlan;
  const grading = examConfig.grading();
  const st = levelStructure(level);
  const parts: MockPartResult[] = [];

  for (const p of plan.parts) {
    const def = partDef(level, p.part);
    if (p.part === "writing") {
      const subs = db.select().from(submissions).where(and(eq(submissions.mockExamId, id), eq(submissions.kind, "writing"))).all();
      const pending = subs.some((s) => s.status !== "graded");
      const rubric = examConfig.writingRubric(level);
      const scores = subs
        .filter((s) => s.status === "graded")
        .map((s) => ({ taskNumber: (db.select().from(tasks).where(eq(tasks.id, s.taskId)).get()?.content as WritingTask | undefined)?.taskNumber ?? 1, score: s.score ?? 0 }));
      const rawMax = p.taskIds.reduce((n, tid) => {
        const tn = (db.select().from(tasks).where(eq(tasks.id, tid)).get()?.content as WritingTask | undefined)?.taskNumber ?? 1;
        return n + (rubric.tasks.find((x) => x.taskNumber === tn)?.maxRaw ?? 0);
      }, 0);
      const raw = scores.reduce((n, x) => n + x.score, 0);
      const started = m.currentPart > plan.parts.indexOf(p);
      let points: number | null = null;
      if (started && !pending) {
        points =
          kind === "mock" && p.taskIds.length === rubric.tasks.length
            ? writingPartPoints(rubric, scores)
            : convertToExamPoints(raw, rawMax, def.maxPoints, rubric.conversion);
      }
      parts.push({ part: p.part, name: p.name, raw: pending || !started ? null : raw, rawMax, points, maxPoints: def.maxPoints, pct: points === null ? null : (points / def.maxPoints) * 100, pending: started && pending });
    } else {
      const rows = db.select().from(attempts).where(and(eq(attempts.mockExamId, id), eq(attempts.section, p.part))).all();
      const raw = rows.reduce((n, r) => n + r.score, 0);
      const rawMax = rows.reduce((n, r) => n + r.maxScore, 0);
      const points = rows.length ? convertToExamPoints(raw, rawMax, def.maxPoints, def.conversion) : null;
      parts.push({ part: p.part, name: p.name, raw: rows.length ? raw : null, rawMax, points, maxPoints: def.maxPoints, pct: points === null ? null : (points / def.maxPoints) * 100, pending: false });
    }
  }

  const writtenMax = st.parts.filter((p) => p.written).reduce((n, p) => n + p.maxPoints, 0);
  const writtenPoints = parts.reduce((n, p) => n + (p.points ?? 0), 0);
  const writtenPct = totalPercent(writtenPoints, writtenMax, grading.percentRounding);
  const complete = parts.every((p) => p.points !== null);

  // oral estimate: recent graded speaking, otherwise the written percentage
  const speakingDef = partDef(level, "speaking");
  const sp = estimateParts(level, 0).find((e) => e.part === "speaking");
  const oralEstimate =
    sp && sp.points !== null
      ? { points: Math.round(sp.points), source: "speaking" as const }
      : { points: Math.round((writtenPct / 100) * speakingDef.maxPoints), source: "written" as const };
  const scores: PartScore[] = [
    ...parts.map((p) => ({ part: p.part, points: p.points, maxPoints: p.maxPoints })),
    { part: "speaking", points: oralEstimate.points, maxPoints: speakingDef.maxPoints },
  ];
  const outcome = examOutcome(level, scores, st, grading);
  const result: MockResult = { parts, writtenPoints, writtenMax, writtenPct, complete, outcome, oralEstimate };
  if (kind === "diagnostic") {
    const known = parts.filter((p) => p.pct !== null);
    const avg = known.length ? known.reduce((n, p) => n + p.pct!, 0) / known.length : 0;
    result.cefr = cefrFor(level, avg);
    const sorted = [...known].sort((a, b) => b.pct! - a.pct!);
    result.strengths = sorted.filter((p) => p.pct! >= avg).map((p) => p.name);
    result.weaknesses = sorted.filter((p) => p.pct! < avg).map((p) => p.name).reverse();
  }
  const status = m.status === "in-progress" || m.status === "abandoned" ? m.status : complete ? "done" : "awaiting-writing";
  db.update(mockExams)
    .set({ result, sectionScores: parts, totalPct: complete ? outcome.pct : null, status })
    .where(eq(mockExams.id, id))
    .run();
  return result;
}

export type WeakCategory = { category: string; name: string; group: string; wrong: number; total: number };

/**
 * The error categories that cost the most in one mock exam / diagnostic:
 * wrong objective items plus the corrections of its graded writing.
 */
export function mockWeakCategories(mockId: number, limit = 6): WeakCategory[] {
  const db = getDb();
  const cats = new Map(examConfig.errorCategories().categories.map((c) => [c.id, c]));
  const counts = new Map<string, { wrong: number; total: number }>();
  const bump = (id: string, wrong: boolean) => {
    const cur = counts.get(id) ?? { wrong: 0, total: 0 };
    cur.total++;
    if (wrong) cur.wrong++;
    counts.set(id, cur);
  };
  for (const a of db.select({ results: attempts.results }).from(attempts).where(eq(attempts.mockExamId, mockId)).all()) {
    for (const r of (a.results as { category: string; correct: boolean }[]) ?? []) bump(r.category, !r.correct);
  }
  const subIds = db.select({ id: submissions.id }).from(submissions).where(eq(submissions.mockExamId, mockId)).all().map((x) => x.id);
  if (subIds.length) {
    for (const e of db.select({ category: errors.category }).from(errors).where(inArray(errors.sourceId, subIds)).all()) bump(e.category, true);
  }
  return [...counts]
    .filter(([, v]) => v.wrong > 0)
    .map(([category, v]) => ({ category, name: cats.get(category)?.name ?? category, group: cats.get(category)?.group ?? "grammar", ...v }))
    .sort((a, b) => b.wrong - a.wrong || a.name.localeCompare(b.name, "hu"))
    .slice(0, limit);
}

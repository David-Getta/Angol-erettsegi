import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { attempts, mockExams, submissions } from "@/lib/db/schema";
import type { Level } from "@/lib/content/schema";
import { examConfig, levelStructure, type PartId } from "@/lib/exam/config";
import { minPointsFor } from "@/lib/scoring/exam";

export type PartEstimate = {
  part: PartId;
  name: string;
  maxPoints: number;
  /** Estimated exam points, null if there is no data yet. */
  points: number | null;
  pct: number | null;
  samples: number;
  minPoints: number;
  targetPoints: number;
  belowMinimum: boolean;
  atRisk: boolean;
};

/** Weighted average with exponentially decaying weights (newest first). */
export function decayedAverage(values: number[], decay: number): number | null {
  if (!values.length) return null;
  let sum = 0;
  let wsum = 0;
  values.forEach((v, i) => {
    const w = Math.pow(decay, i);
    sum += v * w;
    wsum += w;
  });
  return sum / wsum;
}

/**
 * Estimated points per exam part from the most recent results: objective parts
 * from attempts, writing and speaking from graded submissions.
 */
export function estimateParts(level: Level, targetPct: number): PartEstimate[] {
  const db = getDb();
  const { recentAttempts, decay } = examConfig.app().estimate;
  const grading = examConfig.grading();
  return levelStructure(level).parts.map((p) => {
    let pcts: number[] = [];
    if (p.id === "writing" || p.id === "speaking") {
      pcts = db
        .select({ score: submissions.score, max: submissions.maxScore })
        .from(submissions)
        .where(and(eq(submissions.kind, p.id), eq(submissions.level, level), eq(submissions.status, "graded"), isNotNull(submissions.score)))
        .orderBy(desc(submissions.gradedAt))
        .limit(recentAttempts)
        .all()
        .map((r) => ((r.score ?? 0) / (r.max || 1)) * 100);
    } else {
      pcts = db
        .select({ score: attempts.score, max: attempts.maxScore })
        .from(attempts)
        .where(and(eq(attempts.section, p.id), eq(attempts.level, level)))
        .orderBy(desc(attempts.createdAt))
        .limit(recentAttempts)
        .all()
        .map((r) => (r.score / (r.max || 1)) * 100);
    }
    const pct = decayedAverage(pcts, decay);
    const points = pct === null ? null : Math.round((pct / 100) * p.maxPoints * 10) / 10;
    const applies = grading.minPartAppliesTo.includes(p.id);
    const minPoints = applies ? minPointsFor(p.maxPoints, grading) : 0;
    return {
      part: p.id,
      name: p.name,
      maxPoints: p.maxPoints,
      points,
      pct,
      samples: pcts.length,
      minPoints,
      targetPoints: Math.round((targetPct / 100) * p.maxPoints),
      belowMinimum: applies && points !== null && points < minPoints,
      atRisk: applies && pct !== null && pct < grading.minPartPercent + 8,
    };
  });
}

export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 864e5);
}

/** Latest finished diagnostic of the level (CEFR estimate, strengths). */
export function latestDiagnostic(level: Level) {
  const row = getDb()
    .select()
    .from(mockExams)
    .where(and(eq(mockExams.kind, "diagnostic"), eq(mockExams.level, level), inArray(mockExams.status, ["done", "awaiting-writing"])))
    .orderBy(desc(mockExams.createdAt))
    .get();
  return row ?? null;
}

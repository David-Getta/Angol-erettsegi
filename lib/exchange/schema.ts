import { z } from "zod";
import { LevelSchema } from "@/lib/content/schema";

/**
 * File formats of the grading exchange:
 *   exchange/inbox/<id>.json   – a submission waiting for feedback (written by the app)
 *   exchange/outbox/<id>.json  – feedback (written by /javitas or pasted from the Claude app)
 * Both are validated with these schemas; `npm run validate-feedback` checks the outbox.
 */

export const EXCHANGE_VERSION = 1 as const;

const nonEmpty = z.string().trim().min(1, "Nem lehet üres.");

export const SubmissionFileSchema = z.object({
  schemaVersion: z.literal(EXCHANGE_VERSION),
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["writing", "speaking"]),
  createdAt: z.string(),
  level: LevelSchema,
  mode: z.enum(["practice", "exam", "mock", "diagnostic"]),
  version: z.number().int().positive(),
  parentId: z.string().nullable(),
  rubric: z.object({ file: z.string(), id: z.string(), taskNumber: z.number().int().nullable() }),
  task: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    topic: z.string(),
    source: z.enum(["official", "generated"]),
    /** Full task card / oral task as in content/ (situation, guiding points, word limit ...). */
    card: z.record(z.string(), z.unknown()),
  }),
  text: z.string(),
  wordCount: z.number().int().nonnegative(),
  durationSec: z.number().int().nonnegative(),
  transcriptSource: z.enum(["app-asr", "claude-voice", "typed"]).nullable(),
  previousVersion: z
    .object({ id: z.string(), text: z.string(), score: z.number().nullable(), maxScore: z.number().nullable() })
    .nullable(),
  instructions: z.string(),
});
export type SubmissionFile = z.infer<typeof SubmissionFileSchema>;

export const CorrectionSchema = z.object({
  /** Exact text from the submission (copied character by character). */
  original: nonEmpty,
  /** The correct form. */
  corrected: nonEmpty,
  /** Error category id from config/exam/error-categories.json. */
  category: z.string().regex(/^[a-z0-9-]+$/, "Hibakategória-azonosító kell (pl. tense, article)."),
  /** Hungarian: what is wrong, what the correct form is and why (the rule). */
  explanation: nonEmpty,
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const CriterionScoreSchema = z.object({
  id: nonEmpty,
  score: z.number().nonnegative(),
  max: z.number().positive(),
  justification: nonEmpty,
});

export const FeedbackSchema = z
  .object({
    schemaVersion: z.literal(EXCHANGE_VERSION),
    submissionId: nonEmpty,
    kind: z.enum(["writing", "speaking"]),
    gradedAt: z.string().optional(),
    gradedBy: z.enum(["claude-code", "claude-app"]).default("claude-app"),
    rubricId: nonEmpty,
    wordCount: z.number().int().nonnegative().optional(),
    criteria: z.array(CriterionScoreSchema).min(1),
    totalScore: z.number().nonnegative(),
    maxScore: z.number().positive(),
    /** Coverage of every guiding point (irányítási szempont) / every goal of an oral task. */
    taskPoints: z
      .array(
        z.object({
          id: nonEmpty,
          status: z.enum(["covered", "partial", "missing"]),
          comment: nonEmpty,
        }),
      )
      .default([]),
    corrections: z.array(CorrectionSchema).default([]),
    /** Exactly three areas to improve, most important first (Hungarian). */
    priorities: z.array(nonEmpty).length(3, "Pontosan 3 fejlesztendő terület kell."),
    /** The student's own text improved by one level (not a new text). */
    improvedVersion: nonEmpty,
    usefulPhrases: z.array(z.object({ en: nonEmpty, hu: nonEmpty, example: z.string().optional() })).default([]),
    summary: nonEmpty,
  })
  .superRefine((f, ctx) => {
    const sum = f.criteria.reduce((s, c) => s + c.score, 0);
    if (Math.abs(sum - f.totalScore) > 0.001) {
      ctx.addIssue({
        code: "custom",
        path: ["totalScore"],
        message: `A totalScore (${f.totalScore}) nem egyezik a szempontok összegével (${sum}).`,
      });
    }
    const maxSum = f.criteria.reduce((s, c) => s + c.max, 0);
    if (Math.abs(maxSum - f.maxScore) > 0.001) {
      ctx.addIssue({
        code: "custom",
        path: ["maxScore"],
        message: `A maxScore (${f.maxScore}) nem egyezik a szempontok maximumának összegével (${maxSum}).`,
      });
    }
    f.criteria.forEach((c, i) => {
      if (c.score > c.max) {
        ctx.addIssue({ code: "custom", path: ["criteria", i, "score"], message: `A pontszám (${c.score}) nagyobb a maximumnál (${c.max}).` });
      }
    });
  });
export type Feedback = z.infer<typeof FeedbackSchema>;

/** Hungarian names of the feedback fields, for readable error messages. */
const FIELD_NAMES: Record<string, string> = {
  schemaVersion: "schemaVersion (formátumverzió)",
  submissionId: "submissionId (beadás azonosítója)",
  kind: "kind (writing vagy speaking)",
  rubricId: "rubricId (rubrika azonosítója)",
  criteria: "criteria (szempontonkénti pontok)",
  totalScore: "totalScore (összpontszám)",
  maxScore: "maxScore (maximális pontszám)",
  taskPoints: "taskPoints (irányítási pontok)",
  corrections: "corrections (javítások)",
  priorities: "priorities (3 fejlesztendő terület)",
  improvedVersion: "improvedVersion (feljavított változat)",
  usefulPhrases: "usefulPhrases (hasznos kifejezések)",
  summary: "summary (összefoglaló)",
  justification: "justification (indoklás)",
  explanation: "explanation (magyarázat)",
  original: "original (eredeti szövegrész)",
  corrected: "corrected (javított forma)",
  category: "category (hibakategória)",
  score: "score (pont)",
  max: "max (maximum)",
  status: "status (covered / partial / missing)",
  comment: "comment (megjegyzés)",
};

/** Turns Zod issues into a Hungarian list, e.g. "corrections → 2. elem → explanation: hiányzik". */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path
      .map((p) => (typeof p === "number" ? `${p + 1}. elem` : FIELD_NAMES[String(p)] ?? String(p)))
      .join(" → ");
    let msg = issue.message;
    if (issue.code === "invalid_type" && /received undefined/i.test(issue.message)) msg = "hiányzik";
    else if (issue.code === "invalid_type") msg = `rossz típus (${issue.message})`;
    else if (issue.code === "invalid_value") msg = `nem megengedett érték (${issue.message})`;
    return where ? `${where}: ${msg}` : msg;
  });
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

/**
 * Parses pasted or file JSON. Accepts text that wraps the JSON in a ```json
 * fence or has prose around it (as chat answers often do).
 */
export function parseFeedbackText(text: string): ParseResult<Feedback> {
  const json = extractJson(text);
  if (json === null) {
    return { ok: false, errors: ["Nem találtam JSON-objektumot a szövegben. A választ { és } közé kell tenni."] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`A JSON szintaktikailag hibás: ${(e as Error).message}`] };
  }
  const parsed = FeedbackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: describeIssues(parsed.error) };
  return { ok: true, data: parsed.data };
}

export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

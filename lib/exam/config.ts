import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { paths } from "@/lib/paths";
import { LevelSchema, type Level } from "@/lib/content/schema";

/**
 * Loaders for config/exam/*.json and config/app.json. Official exam facts live
 * only in these files, never in the code.
 */

const SourceSchema = z.object({ title: z.string(), url: z.string() });
const MetaSchema = z.object({
  sources: z.array(SourceSchema).default([]),
  verifiedAt: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

export const PartIdSchema = z.enum(["reading", "language-use", "listening", "writing", "speaking"]);
export type PartId = z.infer<typeof PartIdSchema>;
export const WRITTEN_PARTS: PartId[] = ["reading", "language-use", "listening", "writing"];

const ConversionSchema = z.object({
  method: z.enum(["proportional", "table", "identity"]).default("proportional"),
  rawMax: z.number().positive().optional(),
  /** raw score -> exam points, used when method = table and the raw max matches. */
  table: z.array(z.object({ raw: z.number(), points: z.number() })).optional(),
});

const PartSchema = z.object({
  id: PartIdSchema,
  name: z.string(),
  nameEn: z.string(),
  written: z.boolean(),
  order: z.number().int(),
  timeMin: z.number().positive().optional(),
  maxPoints: z.number().positive(),
  taskCount: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  /** Number of tasks a full mock exam uses for this part. */
  mockTaskCount: z.number().int().positive().optional(),
  conversion: ConversionSchema.default({ method: "proportional" }),
  notes: z.array(z.string()).default([]),
});
export type ExamPart = z.infer<typeof PartSchema>;

const LevelStructureSchema = z.object({
  name: z.string(),
  cefr: z.string(),
  writtenTotalMin: z.number().positive(),
  totalPoints: z.number().positive(),
  parts: z.array(PartSchema).min(5),
  breaks: z.array(z.object({ afterPart: PartIdSchema, minutes: z.number(), note: z.string().optional() })).default([]),
  listening: z.object({ plays: z.number().int(), prepSeconds: z.number().int(), pauseSeconds: z.number().int() }),
  oral: z.object({
    durationMin: z.string(),
    prepMin: z.string().optional(),
    parts: z.array(z.object({ number: z.number().int(), name: z.string(), description: z.string(), minutes: z.string().optional() })),
  }),
  textLength: z
    .record(z.string(), z.object({ min: z.number().int(), max: z.number().int() }))
    .default({}),
});

export const StructureSchema = z.object({
  meta: MetaSchema,
  levels: z.object({ kozep: LevelStructureSchema, emelt: LevelStructureSchema }),
});
export type ExamStructure = z.infer<typeof StructureSchema>;
export type LevelStructure = z.infer<typeof LevelStructureSchema>;

export const GradingSchema = z.object({
  meta: MetaSchema,
  minPartPercent: z.number().min(0).max(100),
  minPartAppliesTo: z.array(PartIdSchema),
  minPartNote: z.string(),
  /** Grade boundaries, highest grade first. */
  gradeBoundaries: z.record(
    LevelSchema,
    z.array(z.object({ grade: z.number().int().min(1).max(5), name: z.string(), minPct: z.number() })),
  ),
  languageExamEquivalence: z.array(
    z.object({
      level: LevelSchema,
      minPct: z.number(),
      maxPct: z.number().optional(),
      cefr: z.string(),
      label: z.string(),
    }),
  ),
  languageExamNote: z.string(),
  percentRounding: z.enum(["round", "floor"]).default("round"),
});
export type Grading = z.infer<typeof GradingSchema>;

const BandSchema = z.object({ points: z.string(), descriptor: z.string() });
const CriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().optional(),
  max: z.number().nonnegative(),
  description: z.string(),
  bands: z.array(BandSchema).default([]),
});
export type RubricCriterion = z.infer<typeof CriterionSchema>;

const RubricTaskSchema = z.object({
  taskNumber: z.number().int(),
  name: z.string(),
  textTypes: z.array(z.string()),
  wordLimit: z.object({ min: z.number().int(), max: z.number().int() }),
  guidingPoints: z.string(),
  suggestedMinutes: z.number().optional(),
  maxRaw: z.number().positive(),
  criteria: z.array(CriterionSchema).min(1),
  rules: z.array(z.string()).default([]),
});
export type RubricTask = z.infer<typeof RubricTaskSchema>;

export const WritingRubricSchema = z.object({
  meta: MetaSchema,
  id: z.string(),
  level: LevelSchema,
  examMaxPoints: z.number().positive(),
  tasks: z.array(RubricTaskSchema).min(1),
  conversion: ConversionSchema,
  generalRules: z.array(z.string()).default([]),
});
export type WritingRubric = z.infer<typeof WritingRubricSchema>;

const SpeakingRubricTaskSchema = z.object({
  id: z.string(),
  partNumber: z.number().int(),
  name: z.string(),
  /** Speaking task types (content `type`) graded with these criteria. */
  types: z.array(z.string()).min(1),
  criteria: z.array(CriterionSchema).min(1),
});
export type SpeakingRubricTask = z.infer<typeof SpeakingRubricTaskSchema>;

export const SpeakingRubricSchema = z.object({
  meta: MetaSchema,
  id: z.string(),
  level: LevelSchema,
  examMaxPoints: z.number().positive(),
  /** Per exam task: the criteria used for one practice answer of that type. */
  tasks: z.array(SpeakingRubricTaskSchema).min(1),
  /** Criteria given for the whole oral exam (e.g. pronunciation) – not graded from a transcript. */
  overall: z.array(CriterionSchema).default([]),
  conversion: ConversionSchema.default({ method: "proportional" }),
  /** Official exam scoring, for information. */
  officialScoring: z.array(z.string()).default([]),
  generalRules: z.array(z.string()).default([]),
});
export type SpeakingRubric = z.infer<typeof SpeakingRubricSchema>;

export const TopicsSchema = z.object({
  meta: MetaSchema,
  topics: z.array(
    z.object({
      id: z.string(),
      number: z.number().int(),
      name: z.string(),
      nameEn: z.string(),
      subtopics: z.array(z.string()).default([]),
    }),
  ),
});
export type Topic = z.infer<typeof TopicsSchema>["topics"][number];

const TaskTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string(),
  levels: z.array(LevelSchema),
  description: z.string(),
  itemKinds: z.array(z.enum(["choice", "match", "tf", "text"])).default([]),
});
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskTypesSchema = z.object({
  meta: MetaSchema,
  reading: z.array(TaskTypeSchema),
  "language-use": z.array(TaskTypeSchema),
  listening: z.array(TaskTypeSchema),
  writing: z.array(TaskTypeSchema),
  speaking: z.array(TaskTypeSchema),
});
export type TaskTypes = z.infer<typeof TaskTypesSchema>;

export const ErrorCategoriesSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      group: z.enum(["grammar", "vocabulary", "writing", "comprehension"]),
      description: z.string(),
    }),
  ),
});
export type ErrorCategory = z.infer<typeof ErrorCategoriesSchema>["categories"][number];

export const AppConfigSchema = z.object({
  improving: z.object({ lastN: z.number().int().positive(), minPct: z.number().min(0).max(100) }),
  lowStock: z.object({ threshold: z.number().int().nonnegative(), suggestCount: z.number().int().positive() }),
  estimate: z.object({ recentAttempts: z.number().int().positive(), decay: z.number().positive().max(1) }),
  targeted: z.object({ itemsPerRound: z.number().int().positive(), minBankItems: z.number().int().positive() }),
  dailyPlan: z.object({ minTasks: z.number().int(), maxTasks: z.number().int() }),
  textAnswers: z.object({ acceptNearMissIn: z.array(z.enum(["reading", "language-use", "listening"])).default([]) }),
  /** Re-asking language-use items the student got wrong: not before minAgeHours after the mistake. */
  review: z
    .object({ minAgeHours: z.number().nonnegative(), itemsPerRound: z.number().int().positive(), planMinDue: z.number().int().positive() })
    .default({ minAgeHours: 20, itemsPerRound: 15, planMinDue: 3 }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

/* ------------------------------------------------------------------ */

const cache = new Map<string, unknown>();

function load<T>(file: string, schema: z.ZodType<T>): T {
  const full = path.join(paths.config, file);
  if (process.env.NODE_ENV === "production" && cache.has(full)) return cache.get(full) as T;
  const raw = JSON.parse(fs.readFileSync(full, "utf8"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Hibás konfiguráció: ${file}\n${z.prettifyError(parsed.error)}`);
  }
  cache.set(full, parsed.data);
  return parsed.data;
}

export const examConfig = {
  structure: () => load("exam/structure.json", StructureSchema),
  grading: () => load("exam/grading.json", GradingSchema),
  writingRubric: (level: Level) => load(`exam/writing-rubric-${level}.json`, WritingRubricSchema),
  speakingRubric: (level: Level) => load(`exam/speaking-rubric-${level}.json`, SpeakingRubricSchema),
  topics: () => load("exam/topics.json", TopicsSchema),
  taskTypes: () => load("exam/task-types.json", TaskTypesSchema),
  errorCategories: () => load("exam/error-categories.json", ErrorCategoriesSchema),
  app: () => load("app.json", AppConfigSchema),
};

export type ConfigProvenance = { file: string; verifiedAt: string | null; notes: string[]; sources: { title: string; url: string }[] };

/** Where each official exam config file comes from (shown on the settings page). */
export function examConfigProvenance(): ConfigProvenance[] {
  const entries: [string, { meta: z.infer<typeof MetaSchema> }][] = [
    ["exam/structure.json", examConfig.structure()],
    ["exam/grading.json", examConfig.grading()],
    ["exam/writing-rubric-kozep.json", examConfig.writingRubric("kozep")],
    ["exam/writing-rubric-emelt.json", examConfig.writingRubric("emelt")],
    ["exam/speaking-rubric-kozep.json", examConfig.speakingRubric("kozep")],
    ["exam/speaking-rubric-emelt.json", examConfig.speakingRubric("emelt")],
    ["exam/topics.json", examConfig.topics()],
    ["exam/task-types.json", examConfig.taskTypes()],
  ];
  return entries.map(([file, c]) => ({ file: `config/${file}`, verifiedAt: c.meta.verifiedAt ?? null, notes: c.meta.notes, sources: c.meta.sources }));
}

export function levelStructure(level: Level): LevelStructure {
  return examConfig.structure().levels[level];
}

export function part(level: Level, id: PartId): ExamPart {
  const p = levelStructure(level).parts.find((x) => x.id === id);
  if (!p) throw new Error(`Ismeretlen vizsgarész: ${id}`);
  return p;
}

export function topicName(id: string): string {
  return examConfig.topics().topics.find((t) => t.id === id)?.name ?? id;
}

export function categoryName(id: string): string {
  return examConfig.errorCategories().categories.find((c) => c.id === id)?.name ?? id;
}

export function taskTypeName(section: keyof Omit<TaskTypes, "meta">, id: string): string {
  return examConfig.taskTypes()[section].find((t) => t.id === id)?.name ?? id;
}

/** Plain lookup tables for client components. */
export function labelMaps() {
  const tt = examConfig.taskTypes();
  const taskTypes: Record<string, string> = {};
  for (const s of ["reading", "language-use", "listening", "writing", "speaking"] as const) {
    for (const t of tt[s]) taskTypes[`${s}:${t.id}`] = t.name;
  }
  return {
    topics: Object.fromEntries(examConfig.topics().topics.map((t) => [t.id, t.name])) as Record<string, string>,
    categories: Object.fromEntries(examConfig.errorCategories().categories.map((c) => [c.id, c.name])) as Record<
      string,
      string
    >,
    taskTypes,
  };
}
export type LabelMaps = ReturnType<typeof labelMaps>;

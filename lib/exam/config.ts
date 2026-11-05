import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { paths } from "@/lib/paths";
import { LevelSchema, type Level } from "@/lib/content/schema";
import { getSettings } from "@/lib/settings";

/**
 * Loaders for config/subjects.json, config/subjects/<subject>/*.json and
 * config/app.json. Official exam facts live only in these files, never in the
 * code. `examConfig` reads the config of the subject the student is working
 * on (settings.subject); `configFor(subject)` reads any subject's config.
 */

const SourceSchema = z.object({ title: z.string(), url: z.string() });
const MetaSchema = z.object({
  sources: z.array(SourceSchema).default([]),
  verifiedAt: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

/**
 * Exam part slots. Every subject maps its own parts onto these five ids (the
 * names, URL slugs and features come from the subject's structure.json):
 * three objective slots (reading, language-use, listening), one written-task
 * slot (writing) and one oral slot (speaking). A subject uses any subset.
 */
export const PartIdSchema = z.enum(["reading", "language-use", "listening", "writing", "speaking"]);
export type PartId = z.infer<typeof PartIdSchema>;
export const WRITTEN_PARTS: PartId[] = ["reading", "language-use", "listening", "writing"];
export const OBJECTIVE_PARTS: PartId[] = ["reading", "language-use", "listening"];
export const PartKindSchema = z.enum(["objective", "written", "oral"]);
export type PartKind = z.infer<typeof PartKindSchema>;

export const SubjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  short: z.string(),
  icon: z.string(),
  color: z.string().optional(),
  group: z.enum(["kotelezo", "nyelv", "termeszettudomany", "egyeb"]),
  /** Foreign language: listening with TTS, speech recognition, word cards en-hu style. */
  language: z.boolean().default(false),
  /** Prefix of every content id of the subject (ids are global database keys); empty for the original English bank. */
  idPrefix: z.string().regex(/^[a-z0-9]*$/).default(""),
  /** Language of text-to-speech and speech recognition (BCP 47, e.g. en-GB, de-DE, hu-HU). */
  speechLang: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default("hu-HU"),
  /** Language subjects: the name of the language in Hungarian ("angol"), used in card-type labels. */
  languageName: z.string().optional(),
  available: z.boolean().default(true),
  defaultLevel: LevelSchema.default("kozep"),
  defaultExamDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
});
export type Subject = z.infer<typeof SubjectSchema>;
export const SubjectsSchema = z.object({ meta: MetaSchema, subjects: z.array(SubjectSchema).min(1) });

const ConversionSchema = z.object({
  method: z.enum(["proportional", "table", "identity"]).default("proportional"),
  rawMax: z.number().positive().optional(),
  /** raw score -> exam points, used when method = table and the raw max matches. */
  table: z.array(z.object({ raw: z.number(), points: z.number() })).optional(),
});

/** What the validator and the UI expect from the tasks of a part. */
const PartFeaturesSchema = z.object({
  /** Items must quote the passage / script (reading, listening). */
  evidence: z.boolean().default(false),
  /** A glossary is required (reading of a language). */
  glossary: z.boolean().default(false),
  /** Choice items must explain why the wrong options are wrong. */
  wrongOptions: z.boolean().default(false),
  /** Tasks carry a listening script read by TTS. */
  audio: z.boolean().default(false),
  /** Items can be practised on their own (targeted practice, mistake review). */
  targeted: z.boolean().default(false),
  /** Allowed error-category groups for the items (empty = any). */
  categoryGroups: z.array(z.string()).default([]),
});
export type PartFeatures = z.infer<typeof PartFeaturesSchema>;

const PartSchema = z.object({
  id: PartIdSchema,
  kind: PartKindSchema,
  /** URL segment of the part in this subject (e.g. olvasas, rovid-feladatok). */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** Hungarian one-liner shown under the part's title. */
  intro: z.string().optional(),
  /** Icon for the navigation (emoji); defaults by kind. */
  icon: z.string().optional(),
  nameEn: z.string().optional(),
  written: z.boolean(),
  order: z.number().int(),
  timeMin: z.number().positive().optional(),
  /** 0 = practice-only part that is not part of the exam (it is left out of the mock exam and the totals). */
  maxPoints: z.number().nonnegative(),
  taskCount: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  /** Number of tasks a full mock exam uses for this part. */
  mockTaskCount: z.number().int().positive().optional(),
  conversion: ConversionSchema.default({ method: "proportional" }),
  notes: z.array(z.string()).default([]),
  /** Oral part that is only taken when the written result is below a percentage (matematika középszint). */
  conditional: z.object({ ifWrittenPctBelow: z.number(), note: z.string() }).optional(),
  features: PartFeaturesSchema.default({ evidence: false, glossary: false, wrongOptions: false, audio: false, targeted: false, categoryGroups: [] }),
});
export type ExamPart = z.infer<typeof PartSchema>;

const LevelStructureSchema = z.object({
  name: z.string(),
  /** Language subjects: the CEFR level of the exam (shown as a badge); empty for other subjects. */
  cefr: z.string().default(""),
  writtenTotalMin: z.number().positive(),
  totalPoints: z.number().positive(),
  parts: z.array(PartSchema).min(1),
  breaks: z.array(z.object({ afterPart: PartIdSchema, minutes: z.number(), note: z.string().optional() })).default([]),
  listening: z.object({ plays: z.number().int(), prepSeconds: z.number().int(), pauseSeconds: z.number().int() }).optional(),
  oral: z
    .object({
      durationMin: z.string(),
      prepMin: z.string().optional(),
      parts: z.array(z.object({ number: z.number().int(), name: z.string(), description: z.string(), minutes: z.string().optional() })),
      note: z.string().optional(),
    })
    .optional(),
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
  /** Parts that must each reach the minimum; "written" = the written parts together (one vizsgarész, as in most subjects). */
  minPartAppliesTo: z.array(z.union([PartIdSchema, z.literal("written")])),
  minPartNote: z.string(),
  /** Grade boundaries, highest grade first. */
  gradeBoundaries: z.record(
    LevelSchema,
    z.array(z.object({ grade: z.number().int().min(1).max(5), name: z.string(), minPct: z.number() })),
  ),
  languageExamEquivalence: z
    .array(
      z.object({
        level: LevelSchema,
        minPct: z.number(),
        maxPct: z.number().optional(),
        cefr: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
  languageExamNote: z.string().default(""),
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
  /** Content task types (config task-types.json → writing) this rubric task covers. */
  textTypes: z.array(z.string()).default([]),
  /** Word limit of the text (languages, essays); absent for e.g. maths solutions. */
  wordLimit: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  guidingPoints: z.string().default(""),
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
  reading: z.array(TaskTypeSchema).default([]),
  "language-use": z.array(TaskTypeSchema).default([]),
  listening: z.array(TaskTypeSchema).default([]),
  writing: z.array(TaskTypeSchema).default([]),
  speaking: z.array(TaskTypeSchema).default([]),
});
export type TaskTypes = z.infer<typeof TaskTypesSchema>;

export const ErrorCategoriesSchema = z.object({
  meta: MetaSchema.optional(),
  /** Group ids with Hungarian names; the English subject uses grammar / vocabulary / writing / comprehension. */
  groups: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      group: z.string(),
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
  textAnswers: z.object({ acceptNearMissIn: z.array(PartIdSchema).default([]) }),
  /** Re-asking language-use items the student got wrong: not before minAgeHours after the mistake. */
  review: z
    .object({ minAgeHours: z.number().nonnegative(), itemsPerRound: z.number().int().positive(), planMinDue: z.number().int().positive() })
    .default({ minAgeHours: 20, itemsPerRound: 15, planMinDue: 3 }),
  /** Automatic database backup when the dev server starts: at most every `everyDays`, keeping the newest `keep` automatic copies. */
  backup: z.object({ everyDays: z.number().positive(), keep: z.number().int().positive() }).default({ everyDays: 3, keep: 10 }),
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

export function subjects(): Subject[] {
  return load("subjects.json", SubjectsSchema).subjects.filter((x) => x.available);
}

export function subject(id: string): Subject {
  const s = load("subjects.json", SubjectsSchema).subjects.find((x) => x.id === id);
  if (!s) throw new Error(`Ismeretlen tantárgy: ${id}`);
  return s;
}

export function isSubject(id: string): boolean {
  return load("subjects.json", SubjectsSchema).subjects.some((x) => x.id === id);
}

let subjectOverride: string | null = null;

/** The subject the student is working on (settings), or the one set by `withSubject`. */
export function currentSubject(): string {
  return subjectOverride ?? getSettings().subject;
}

/** `mat-` for matematika, "" for angol: what every content id of the subject starts with. */
export function contentIdPrefix(subjectId: string = currentSubject()): string {
  const p = subject(subjectId).idPrefix;
  return p ? `${p}-` : "";
}

/** Runs a synchronous computation as if another subject were current (used by the subject chooser's summaries). */
export function withSubject<T>(id: string, fn: () => T): T {
  const prev = subjectOverride;
  subjectOverride = id;
  try {
    return fn();
  } finally {
    subjectOverride = prev;
  }
}

export type SubjectConfig = ReturnType<typeof configFor>;

/** The exam config of one subject (used by the validator, the seed and the commands for any subject). */
export function configFor(subjectId: string) {
  const dir = `subjects/${subjectId}`;
  return {
    id: subjectId,
    info: () => subject(subjectId),
    structure: () => load(`${dir}/structure.json`, StructureSchema),
    grading: () => load(`${dir}/grading.json`, GradingSchema),
    writingRubric: (level: Level) => load(`${dir}/writing-rubric-${level}.json`, WritingRubricSchema),
    speakingRubric: (level: Level) => load(`${dir}/speaking-rubric-${level}.json`, SpeakingRubricSchema),
    topics: () => load(`${dir}/topics.json`, TopicsSchema),
    taskTypes: () => load(`${dir}/task-types.json`, TaskTypesSchema),
    errorCategories: () => load(`${dir}/error-categories.json`, ErrorCategoriesSchema),
    hasRubric: (kind: "writing" | "speaking", level: Level) => fs.existsSync(path.join(paths.config, `${dir}/${kind}-rubric-${level}.json`)),
  };
}

/** The config of the current subject (server side: it reads the settings). */
export const examConfig = {
  subject: () => subject(currentSubject()),
  structure: () => configFor(currentSubject()).structure(),
  grading: () => configFor(currentSubject()).grading(),
  writingRubric: (level: Level) => configFor(currentSubject()).writingRubric(level),
  speakingRubric: (level: Level) => configFor(currentSubject()).speakingRubric(level),
  topics: () => configFor(currentSubject()).topics(),
  taskTypes: () => configFor(currentSubject()).taskTypes(),
  errorCategories: () => configFor(currentSubject()).errorCategories(),
  app: () => load("app.json", AppConfigSchema),
};

export type ConfigProvenance = { file: string; verifiedAt: string | null; notes: string[]; sources: { title: string; url: string }[] };

/** Where each official exam config file of a subject comes from (shown on the settings page). */
export function examConfigProvenance(subjectId: string = currentSubject()): ConfigProvenance[] {
  const c = configFor(subjectId);
  const entries: [string, { meta?: z.infer<typeof MetaSchema> } | null][] = [
    ["structure.json", c.structure()],
    ["grading.json", c.grading()],
    ["topics.json", c.topics()],
    ["task-types.json", c.taskTypes()],
  ];
  for (const level of ["kozep", "emelt"] as const) {
    if (c.hasRubric("writing", level)) entries.push([`writing-rubric-${level}.json`, c.writingRubric(level)]);
    if (c.hasRubric("speaking", level)) entries.push([`speaking-rubric-${level}.json`, c.speakingRubric(level)]);
  }
  return entries
    .filter((e): e is [string, { meta?: z.infer<typeof MetaSchema> }] => e[1] !== null)
    .map(([file, cfg]) => ({
      file: `config/subjects/${subjectId}/${file}`,
      verifiedAt: cfg.meta?.verifiedAt ?? null,
      notes: cfg.meta?.notes ?? [],
      sources: cfg.meta?.sources ?? [],
    }));
}

export function levelStructure(level: Level): LevelStructure {
  return examConfig.structure().levels[level];
}

export function part(level: Level, id: PartId): ExamPart {
  const p = levelStructure(level).parts.find((x) => x.id === id);
  if (!p) throw new Error(`Ismeretlen vizsgarész: ${id}`);
  return p;
}

/** The part with this id in the current subject (any level), or undefined if the subject does not use the slot. */
export function findPart(id: string, level?: Level): ExamPart | undefined {
  const st = examConfig.structure();
  const levels = level ? [st.levels[level]] : [st.levels.kozep, st.levels.emelt];
  for (const l of levels) {
    const p = l.parts.find((x) => x.id === id);
    if (p) return p;
  }
  return undefined;
}

/** Hungarian name of a part / section id in the current subject (falls back to the id). */
export function partName(id: string, level?: Level): string {
  return findPart(id, level)?.name ?? id;
}

/** The part behind a URL slug in the current subject. */
export function partBySlug(slug: string, level?: Level): ExamPart | undefined {
  const st = examConfig.structure();
  const levels = level ? [st.levels[level]] : [st.levels.kozep, st.levels.emelt];
  for (const l of levels) {
    const p = l.parts.find((x) => x.slug === slug);
    if (p) return p;
  }
  return undefined;
}

/** URL path of a part in the current subject. */
export function partPath(id: string): string {
  const p = findPart(id);
  return p ? `/${p.slug}` : `/${id}`;
}

/** URL of the targeted-practice page: the first part with the `targeted` feature (defaults to the language-use slot). */
export function targetedPath(): string {
  const st = examConfig.structure();
  const p = [...st.levels.kozep.parts, ...st.levels.emelt.parts].find((x) => x.features.targeted);
  return p ? `/${p.slug}/celzott` : `/${findPart("language-use")?.slug ?? "nyelvhelyesseg"}/celzott`;
}

/** The written parts of a level, in exam order. */
export function writtenParts(level: Level): ExamPart[] {
  return levelStructure(level).parts.filter((p) => p.written).sort((a, b) => a.order - b.order);
}

/** The oral part of a level, if the subject has one. */
export function oralPart(level: Level): ExamPart | undefined {
  return levelStructure(level).parts.find((p) => p.kind === "oral");
}

/** The parts of a level with a given kind. */
export function partsOfKind(level: Level, kind: PartKind): ExamPart[] {
  return levelStructure(level).parts.filter((p) => p.kind === kind);
}

/** Name of an error-category group of the current subject. */
export function categoryGroupName(id: string): string {
  return examConfig.errorCategories().groups.find((g) => g.id === id)?.name ?? id;
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

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { settings, meta } from "@/lib/db/schema";
import { paths } from "@/lib/paths";
import { LevelSchema, type Level } from "@/lib/content/schema";

export const CARD_TYPES = ["en-hu", "hu-en", "cloze", "collocation"] as const;
export type CardType = (typeof CARD_TYPES)[number];

const DEFAULT_SUBJECT = "angol";

/** Per-subject settings. */
export const SubjectSettingsSchema = z.object({
  level: LevelSchema,
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Target total percentage (the target points are derived from it). */
  targetPct: z.number().min(0).max(100),
  onboardingDone: z.boolean().default(false),
});
export type SubjectSettings = z.infer<typeof SubjectSettingsSchema>;

export const StoredSettingsSchema = z.object({
  /** The subject the student is working on. */
  subject: z.string().default(DEFAULT_SUBJECT),
  subjects: z.record(z.string(), SubjectSettingsSchema.partial()).default({}),
  dailyNewCards: z.number().int().min(0).max(200).default(15),
  dailyMaxReviews: z.number().int().min(10).max(1000).default(150),
  cardTypes: z.array(z.enum(CARD_TYPES)).min(1).default(["en-hu", "hu-en", "cloze"]),
  ttsRate: z.number().min(0.5).max(1.5).default(0.95),
  ttsVoiceFemale: z.string().nullable().default(null),
  ttsVoiceMale: z.string().nullable().default(null),
  theme: z.enum(["system", "light", "dark"]).default("system"),
});
type StoredSettings = z.infer<typeof StoredSettingsSchema>;

/**
 * What the app works with: the stored settings plus the current subject's
 * level, exam date, target and onboarding flag flattened in (the subject's
 * defaults from config/subjects.json where nothing is stored yet).
 */
export const SettingsSchema = StoredSettingsSchema.extend(SubjectSettingsSchema.shape);
export type Settings = z.infer<typeof SettingsSchema>;

/** Keys that belong to the current subject, not to the app as a whole. */
const SUBJECT_KEYS = Object.keys(SubjectSettingsSchema.shape) as (keyof SubjectSettings)[];

type SubjectDefaults = { id: string; defaultLevel?: Level; defaultExamDate?: string };

/** Minimal read of config/subjects.json (the full loader lives in lib/exam/config and reads the settings itself). */
function subjectDefaults(id: string): SubjectDefaults {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(paths.config, "subjects.json"), "utf8")) as { subjects: SubjectDefaults[] };
    return raw.subjects.find((s) => s.id === id) ?? { id };
  } catch {
    return { id };
  }
}

function withSubject(stored: StoredSettings): Settings {
  const d = subjectDefaults(stored.subject);
  const own = stored.subjects[stored.subject] ?? {};
  return {
    ...stored,
    level: own.level ?? d.defaultLevel ?? "kozep",
    examDate: own.examDate ?? d.defaultExamDate ?? "2027-05-03",
    targetPct: own.targetPct ?? 60,
    onboardingDone: own.onboardingDone ?? false,
  };
}

function readStored(): StoredSettings {
  const row = getDb().select().from(settings).where(eq(settings.id, 1)).get();
  const data = (row?.data ?? {}) as Record<string, unknown>;
  // settings saved before subjects existed: level / examDate / targetPct / onboardingDone were top-level
  if (!("subjects" in data) && ("level" in data || "examDate" in data || "targetPct" in data)) {
    const legacy = SubjectSettingsSchema.partial().safeParse(data);
    data.subjects = { [DEFAULT_SUBJECT]: legacy.success ? legacy.data : {} };
  }
  const parsed = StoredSettingsSchema.safeParse(data);
  return parsed.success ? parsed.data : StoredSettingsSchema.parse({});
}

export function getSettings(): Settings {
  return withSubject(readStored());
}

/** Settings of another subject (for the subject chooser). */
export function settingsFor(subjectId: string): SubjectSettings {
  const stored = readStored();
  return withSubject({ ...stored, subject: subjectId });
}

function write(next: StoredSettings): void {
  getDb()
    .insert(settings)
    .values({ id: 1, data: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.id, set: { data: next, updatedAt: new Date() } })
    .run();
}

/** Updates app-wide settings and the current subject's own ones in one patch. */
export function updateSettings(patch: Partial<Settings>): Settings {
  const stored = readStored();
  const subjectId = patch.subject ?? stored.subject;
  const ownPatch: Partial<SubjectSettings> = {};
  const appPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if ((SUBJECT_KEYS as string[]).includes(k)) (ownPatch as Record<string, unknown>)[k] = v;
    else appPatch[k] = v;
  }
  const next = StoredSettingsSchema.parse({
    ...stored,
    ...appPatch,
    subject: subjectId,
    subjects: { ...stored.subjects, [subjectId]: SubjectSettingsSchema.partial().parse({ ...(stored.subjects[subjectId] ?? {}), ...ownPatch }) },
  });
  write(next);
  return withSubject(next);
}

export function getMeta<T>(key: string): T | null {
  const row = getDb().select().from(meta).where(eq(meta.key, key)).get();
  return (row?.value as T) ?? null;
}

export function setMeta(key: string, value: unknown): void {
  getDb()
    .insert(meta)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: new Date() } })
    .run();
}

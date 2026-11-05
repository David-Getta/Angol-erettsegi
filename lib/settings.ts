import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { settings, meta } from "@/lib/db/schema";
import { LevelSchema } from "@/lib/content/schema";

export const CARD_TYPES = ["en-hu", "hu-en", "cloze", "collocation"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const SettingsSchema = z.object({
  level: LevelSchema.default("emelt"),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2027-05-05"),
  /** Target total percentage (the target points are derived from it). */
  targetPct: z.number().min(0).max(100).default(60),
  dailyNewCards: z.number().int().min(0).max(200).default(15),
  dailyMaxReviews: z.number().int().min(10).max(1000).default(150),
  cardTypes: z.array(z.enum(CARD_TYPES)).min(1).default(["en-hu", "hu-en", "cloze"]),
  ttsRate: z.number().min(0.5).max(1.5).default(0.95),
  ttsVoiceFemale: z.string().nullable().default(null),
  ttsVoiceMale: z.string().nullable().default(null),
  theme: z.enum(["system", "light", "dark"]).default("system"),
  onboardingDone: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function getSettings(): Settings {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  const parsed = SettingsSchema.safeParse(row?.data ?? {});
  return parsed.success ? parsed.data : SettingsSchema.parse({});
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = SettingsSchema.parse({ ...getSettings(), ...patch });
  const db = getDb();
  db.insert(settings)
    .values({ id: 1, data: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.id, set: { data: next, updatedAt: new Date() } })
    .run();
  return next;
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

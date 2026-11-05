"use server";

import { revalidatePath } from "next/cache";
import { updateSettings, SettingsSchema, type Settings } from "@/lib/settings";
import { seedContent } from "@/lib/content/seed";
import type { Level } from "@/lib/content/schema";

export async function setLevelAction(level: Level) {
  updateSettings({ level });
  revalidatePath("/", "layout");
}

export async function setThemeAction(theme: Settings["theme"]) {
  updateSettings({ theme });
}

export async function saveSettingsAction(patch: Partial<Settings>) {
  const parsed = SettingsSchema.partial().safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const s = updateSettings(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true as const, settings: s };
}

export async function reloadContentAction() {
  const r = seedContent();
  revalidatePath("/", "layout");
  return r;
}

export async function importDataAction(text: string) {
  const { importData } = await import("@/lib/backup");
  try {
    const r = importData(JSON.parse(text));
    revalidatePath("/", "layout");
    return { ok: true as const, rows: r.rows };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function backupAction() {
  const { backupDatabase } = await import("@/lib/backup");
  const file = await backupDatabase();
  revalidatePath("/beallitasok");
  return file;
}

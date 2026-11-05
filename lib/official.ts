import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { paths } from "@/lib/paths";
import type { Content } from "@/lib/content/schema";

export type OfficialFolder = { name: string; files: string[]; importedTasks: number };

/** Folders under data/official/ and how many tasks reference each (official.folder). */
export function officialFolders(): OfficialFolder[] {
  if (!fs.existsSync(paths.official)) return [];
  const dirs = fs
    .readdirSync(paths.official, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
  const rows = getDb()
    .select({ content: tasks.content })
    .from(tasks)
    .where(and(eq(tasks.source, "official"), eq(tasks.active, true)))
    .all();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const f = (r.content as Content).official?.folder;
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return dirs.map((name) => ({
    name,
    files: fs.readdirSync(path.join(paths.official, name)).filter((f) => !f.startsWith(".")),
    importedTasks: counts.get(name) ?? 0,
  }));
}

/** Path of an official audio file, or null if it does not exist (guards against path traversal). */
export function officialAudioPath(folder: string, file: string): string | null {
  if (!/^[\w.-]+$/.test(folder) || !/^[\w .()-]+\.(mp3|m4a|wav|ogg)$/i.test(file)) return null;
  const p = path.join(paths.official, folder, file);
  return fs.existsSync(p) ? p : null;
}

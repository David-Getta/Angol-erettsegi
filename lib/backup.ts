import fs from "node:fs";
import path from "node:path";
import { getDb, getSqlite } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { paths, rel } from "@/lib/paths";

/** Progress tables included in export / import (task content lives in content/). */
const TABLES = {
  settings: s.settings,
  meta: s.meta,
  attempts: s.attempts,
  itemAttempts: s.itemAttempts,
  submissions: s.submissions,
  errors: s.errors,
  cards: s.cards,
  reviews: s.reviews,
  mockExams: s.mockExams,
  activity: s.activity,
} as const;
type TableName = keyof typeof TABLES;

/** Column names stored as timestamp_ms (exported as ISO strings). */
const DATE_FIELDS = new Set(["createdAt", "updatedAt", "gradedAt", "dueAt", "reviewedAt", "partStartedAt", "finishedAt"]);

export const EXPORT_FORMAT = "angol-erettsegi-export";

export function exportData(): Record<string, unknown> {
  const db = getDb();
  const out: Record<string, unknown> = { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString() };
  for (const [name, table] of Object.entries(TABLES)) {
    out[name] = db.select().from(table).all();
  }
  return out;
}

export function importData(json: unknown): { tables: number; rows: number } {
  if (!json || typeof json !== "object" || (json as Record<string, unknown>).format !== EXPORT_FORMAT) {
    throw new Error("Ez nem az app exportfájlja (hiányzik a format mező).");
  }
  const data = json as Record<string, unknown>;
  const db = getDb();
  let rows = 0;
  db.transaction((tx) => {
    for (const name of Object.keys(TABLES) as TableName[]) {
      const list = data[name];
      if (!Array.isArray(list)) continue;
      const table = TABLES[name];
      tx.delete(table).run();
      for (const raw of list as Record<string, unknown>[]) {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(raw)) row[k] = DATE_FIELDS.has(k) && typeof v === "string" ? new Date(v) : v;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx.insert(table).values(row as any).run();
        rows++;
      }
    }
  });
  return { tables: Object.keys(TABLES).length, rows };
}

export async function backupDatabase(): Promise<string> {
  fs.mkdirSync(paths.backups, { recursive: true });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const name = `app-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;
  const target = path.join(paths.backups, name);
  await getSqlite().backup(target);
  return rel(target);
}

export function listBackups(): { name: string; size: number; at: Date }[] {
  if (!fs.existsSync(paths.backups)) return [];
  return fs
    .readdirSync(paths.backups)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const st = fs.statSync(path.join(paths.backups, f));
      return { name: f, size: st.size, at: st.mtime };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

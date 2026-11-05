import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { paths } from "@/lib/paths";

export type Db = BetterSQLite3Database<typeof schema>;

type Holder = { db?: Db; sqlite?: Database.Database; file?: string };
const holder = globalThis as unknown as { __angolDb?: Holder };

/**
 * Returns the shared database connection, creating the file and applying
 * pending migrations on first use. Cached on globalThis so dev-mode hot reloads
 * do not open a new connection each time.
 */
export function getDb(): Db {
  const file = paths.db;
  const h = (holder.__angolDb ??= {});
  if (h.db && h.file === file) return h.db;
  if (h.sqlite) h.sqlite.close();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: paths.migrations });
  h.db = db;
  h.sqlite = sqlite;
  h.file = file;
  return db;
}

export function getSqlite(): Database.Database {
  getDb();
  return holder.__angolDb!.sqlite!;
}

export function closeDb(): void {
  const h = holder.__angolDb;
  if (h?.sqlite) h.sqlite.close();
  if (h) {
    h.db = undefined;
    h.sqlite = undefined;
    h.file = undefined;
  }
}

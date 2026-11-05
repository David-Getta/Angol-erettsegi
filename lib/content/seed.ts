import { eq, notInArray, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tasks, meta } from "@/lib/db/schema";
import { paths } from "@/lib/paths";
import { loadAllContent } from "./load";
import type { Content } from "./schema";

export type SeedReport = { inserted: number; updated: number; unchanged: number; deactivated: number; failed: string[] };

function answerKey(c: Content): unknown {
  if (c.section === "reading" || c.section === "language-use" || c.section === "listening") {
    return Object.fromEntries(c.items.map((i) => [i.id, i.answer]));
  }
  return null;
}

function categoriesOf(c: Content): string[] {
  if (c.section === "reading" || c.section === "language-use" || c.section === "listening") {
    return [...new Set(c.items.map((i) => i.category))];
  }
  if (c.section === "grammar") return [c.category];
  return [];
}

function itemCount(c: Content): number {
  if (c.section === "reading" || c.section === "language-use" || c.section === "listening") return c.items.length;
  if (c.section === "vocabulary") return c.cards.length;
  if (c.section === "writing") return c.points.length;
  if (c.section === "grammar") return c.practice.length;
  return 1;
}

/**
 * Mirrors content/ into the tasks table. Idempotent: unchanged files (same
 * hash) are skipped, removed files are deactivated (never deleted, because
 * attempts reference them).
 */
export function seedContent(dir: string = paths.content): SeedReport {
  const db = getDb();
  const { items, failed } = loadAllContent(dir);
  const existing = new Map(db.select({ id: tasks.id, hash: tasks.contentHash, active: tasks.active }).from(tasks).all().map((r) => [r.id, r]));
  const report: SeedReport = { inserted: 0, updated: 0, unchanged: 0, deactivated: 0, failed };
  const seen = new Set<string>();

  db.transaction((tx) => {
    for (const { content: c, relPath, hash } of items) {
      if (seen.has(c.id)) continue; // duplicate ids are reported by the validator
      seen.add(c.id);
      const row = {
        id: c.id,
        section: c.section,
        type: c.type,
        level: c.level,
        source: c.source,
        topic: c.topic,
        title: c.title,
        content: c as unknown,
        answerKey: answerKey(c),
        tags: c.tags,
        categories: categoriesOf(c),
        itemCount: itemCount(c),
        reservedFor: c.reservedFor ?? null,
        contentFile: relPath,
        contentHash: hash,
        active: true,
        updatedAt: new Date(),
      };
      const prev = existing.get(c.id);
      if (!prev) {
        tx.insert(tasks).values(row).run();
        report.inserted++;
      } else if (prev.hash !== hash || !prev.active) {
        tx.update(tasks).set(row).where(eq(tasks.id, c.id)).run();
        report.updated++;
      } else report.unchanged++;
    }
    const ids = [...seen];
    const toDeactivate = tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(ids.length ? and(eq(tasks.active, true), notInArray(tasks.id, ids)) : eq(tasks.active, true))
      .all();
    for (const r of toDeactivate) {
      tx.update(tasks).set({ active: false }).where(eq(tasks.id, r.id)).run();
      report.deactivated++;
    }
    tx.insert(meta)
      .values({ key: "lastSeed", value: { at: new Date().toISOString(), ...report } })
      .onConflictDoUpdate({ target: meta.key, set: { value: { at: new Date().toISOString(), ...report }, updatedAt: new Date() } })
      .run();
  });
  return report;
}

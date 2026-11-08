import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { autoBackup, listBackups } from "@/lib/backup";
import { addWord } from "@/lib/vocab/cards";

describe("automatic backup", () => {
  beforeAll(() => {
    seedContent();
  });

  it("skips an empty database, then backs up progress at most every N days and keeps the newest copies", async () => {
    expect(await autoBackup({ everyDays: 3, keep: 2 })).toBeNull();
    addWord({ term: "backup", meaning: "biztonsági mentés", sourceType: "manual" });
    const first = await autoBackup({ everyDays: 3, keep: 2 });
    expect(first).toMatch(/auto-.*\.db$/);
    // a fresh backup exists → nothing new
    expect(await autoBackup({ everyDays: 3, keep: 2 })).toBeNull();
    // pretend the last backup is old: more copies, only 2 automatic ones kept
    for (let i = 0; i < 3; i++) {
      for (const b of listBackups()) {
        const old = new Date(Date.now() - 10 * 864e5);
        fs.utimesSync(`${process.env.APP_DATA_DIR}/backups/${b.name}`, old, old);
      }
      await new Promise((r) => setTimeout(r, 1100)); // file names have second precision
      expect(await autoBackup({ everyDays: 3, keep: 2 })).not.toBeNull();
    }
    expect(listBackups().filter((b) => b.name.startsWith("auto-"))).toHaveLength(2);
  }, 15000);
});

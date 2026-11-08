import { seedContent } from "@/lib/content/seed";
import { closeDb } from "@/lib/db/client";
import { ensureExchangeDirs } from "@/lib/exchange/files";
import { autoBackup } from "@/lib/backup";
import { examConfig } from "@/lib/exam/config";

async function main() {
  const quiet = process.argv.includes("--quiet");
  ensureExchangeDirs();
  // a copy of the progress before anything touches the database (see config/app.json → backup)
  const backup = await autoBackup(examConfig.app().backup).catch((e: Error) => {
    console.warn(`⚠ Az automatikus mentés nem sikerült: ${e.message}`);
    return null;
  });
  if (backup) console.log(`Automatikus mentés: ${backup}`);
  const r = seedContent();
  closeDb();
  if (!quiet || r.inserted || r.updated || r.deactivated || r.failed.length) {
    console.log(
      `Tartalom betöltve: ${r.inserted} új, ${r.updated} frissített, ${r.unchanged} változatlan, ${r.deactivated} inaktivált feladat.`,
    );
  }
  if (r.failed.length) {
    console.warn(`⚠ ${r.failed.length} fájl hibás, kimaradt (részletek: npm run validate-content):`);
    for (const f of r.failed.slice(0, 10)) console.warn(`  - ${f}`);
  }
}

void main();

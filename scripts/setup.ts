import { ensureExchangeDirs } from "@/lib/exchange/files";
import { getDb, closeDb } from "@/lib/db/client";
import { seedContent } from "@/lib/content/seed";
import { validateContentDir } from "@/lib/content/validate";
import { paths, rel } from "@/lib/paths";

ensureExchangeDirs();
getDb();
console.log(`✓ Adatbázis kész: ${rel(paths.db)}`);
const v = validateContentDir();
console.log(`✓ Tartalom ellenőrizve: ${v.files} fájl, ${v.errors.length} hiba, ${v.warnings.length} figyelmeztetés`);
if (v.errors.length) console.log("  (a hibás fájlok kimaradnak – részletek: npm run validate-content)");
const r = seedContent();
closeDb();
console.log(`✓ Feladatok betöltve: ${r.inserted} új, ${r.updated} frissített, ${r.unchanged} változatlan`);
console.log("\nKész! Indítás: npm run dev  →  http://localhost:3000");

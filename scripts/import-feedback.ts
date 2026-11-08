import { importOutbox } from "@/lib/submissions";
import { importVocabCompletions } from "@/lib/vocab/cards";
import { closeDb } from "@/lib/db/client";
import { listOutbox } from "@/lib/exchange/files";

let failed = 0;
const vocab = importVocabCompletions();
if (vocab.applied) console.log(`✓ ${vocab.applied} szókártya kiegészítve (exchange/vocab/completions.json)`);
for (const e of vocab.errors) {
  failed++;
  console.log(`✗ completions.json: ${e}`);
}

if (listOutbox().length === 0) {
  console.log("Az exchange/outbox/ üres – nincs importálandó javítás.");
} else {
  const r = importOutbox();
  for (const id of r.imported) console.log(`✓ ${id} beimportálva`);
  for (const w of r.warnings) console.log(`! ${w}`);
  for (const f of r.failed) {
    failed++;
    console.log(`✗ ${f.id} hibás, nem importáltam:`);
    for (const e of f.errors) console.log(`    - ${e}`);
  }
  console.log(`\n${r.imported.length} javítás beimportálva, ${r.failed.length} hibás.`);
}
closeDb();
process.exit(failed ? 1 : 0);

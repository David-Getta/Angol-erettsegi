/**
 * Checks exchange/outbox/*.json against the feedback schema and the rubric of
 * the matching inbox submission – without touching the database. Used by the
 * /javitas command before it finishes.
 */
import fs from "node:fs";
import path from "node:path";
import { paths } from "@/lib/paths";
import { parseFeedbackText } from "@/lib/exchange/schema";
import { readInboxFile } from "@/lib/exchange/files";
import { examConfig } from "@/lib/exam/config";
import { writingRubricRef, speakingRubricRef } from "@/lib/exchange/prompts";
import { CompletionsSchema, containsTerm, vocabExchange } from "@/lib/vocab/cards";

const only = process.argv.slice(2);
const files = fs.existsSync(paths.outbox) ? fs.readdirSync(paths.outbox).filter((f) => f.endsWith(".json")) : [];
const cats = new Set(examConfig.errorCategories().categories.map((c) => c.id));
let bad = 0;

for (const f of files) {
  const id = f.replace(/\.json$/, "");
  if (only.length && !only.includes(id)) continue;
  const problems: string[] = [];
  const warnings: string[] = [];
  const parsed = parseFeedbackText(fs.readFileSync(path.join(paths.outbox, f), "utf8"));
  if (!parsed.ok) problems.push(...parsed.errors);
  else {
    const fb = parsed.data;
    if (fb.submissionId !== id) problems.push(`A submissionId (${fb.submissionId}) nem egyezik a fájlnévvel.`);
    const sub = readInboxFile(id);
    if (!sub) warnings.push("Nincs hozzá beadás az exchange/inbox/-ban (már importálva?).");
    else {
      const ref =
        sub.kind === "writing"
          ? writingRubricRef(examConfig.writingRubric(sub.level), sub.rubric.taskNumber ?? 1)
          : speakingRubricRef(examConfig.speakingRubric(sub.level));
      if (fb.rubricId !== ref.id) problems.push(`rubricId: "${ref.id}" kell, nem "${fb.rubricId}".`);
      for (const c of ref.criteria) {
        const got = fb.criteria.find((x) => x.id === c.id);
        if (!got) problems.push(`Hiányzik a(z) "${c.id}" szempont.`);
        else if (got.max !== c.max) problems.push(`A(z) "${c.id}" maximuma ${c.max}, nem ${got.max}.`);
      }
      for (const c of fb.criteria) if (!ref.criteria.some((x) => x.id === c.id)) problems.push(`Ismeretlen szempont: "${c.id}".`);
      fb.corrections.forEach((c, i) => {
        if (!cats.has(c.category)) problems.push(`corrections[${i}]: ismeretlen kategória "${c.category}".`);
        if (!sub.text.toLowerCase().includes(c.original.trim().toLowerCase()))
          warnings.push(`corrections[${i}]: az "original" nem található szó szerint a szövegben: "${c.original}"`);
      });
    }
  }
  if (problems.length) bad++;
  console.log(`${problems.length ? "✗" : "✓"} ${f}`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  for (const w of warnings) console.log(`    ! ${w}`);
}
if (!files.length) console.log("Az exchange/outbox/ üres.");

// exchange/vocab/completions.json (written by /szokincs)
const completions = vocabExchange.completions();
if (fs.existsSync(completions)) {
  try {
    const parsed = CompletionsSchema.safeParse(JSON.parse(fs.readFileSync(completions, "utf8")));
    if (!parsed.success) {
      bad++;
      console.log("✗ exchange/vocab/completions.json");
      for (const i of parsed.error.issues) console.log(`    ✗ ${i.path.join(".")}: ${i.message}`);
    } else {
      console.log(`✓ exchange/vocab/completions.json (${parsed.data.words.length} szó)`);
      for (const w of parsed.data.words) {
        if (!containsTerm(w.example, w.term)) console.log(`    ! „${w.term}”: a példamondat nem tartalmazza a szót`);
      }
    }
  } catch (e) {
    bad++;
    console.log(`✗ exchange/vocab/completions.json: hibás JSON (${(e as Error).message})`);
  }
}
process.exit(bad ? 1 : 0);

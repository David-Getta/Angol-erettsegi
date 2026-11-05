import { validateContentDir } from "@/lib/content/validate";

const showWarnings = !process.argv.includes("--no-warnings");
const report = validateContentDir();

const byFile = (list: typeof report.errors) => {
  const m = new Map<string, string[]>();
  for (const i of list) m.set(i.file, [...(m.get(i.file) ?? []), i.message]);
  return m;
};

if (report.errors.length) {
  console.log("\nHIBÁK:");
  for (const [file, msgs] of byFile(report.errors)) {
    console.log(`  ${file}`);
    for (const m of msgs) console.log(`    ✗ ${m}`);
  }
}
if (showWarnings && report.warnings.length) {
  console.log("\nFIGYELMEZTETÉSEK:");
  for (const [file, msgs] of byFile(report.warnings)) {
    console.log(`  ${file}`);
    for (const m of msgs) console.log(`    ! ${m}`);
  }
}
console.log("\nTartalomkészlet:");
for (const [k, n] of Object.entries(report.byKind).sort()) console.log(`  ${k.padEnd(24)} ${n}`);
console.log(
  `\n${report.files} fájl, ${report.valid} hibátlan, ${report.errors.length} hiba, ${report.warnings.length} figyelmeztetés.`,
);
process.exit(report.errors.length ? 1 : 0);

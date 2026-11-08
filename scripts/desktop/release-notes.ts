/**
 * Extracts one version's section from CHANGELOG.md for the GitHub release body
 * (the desktop app shows this text under "Mi változik?" before updating).
 *
 * Usage: tsx scripts/desktop/release-notes.ts <version> [--out <file>] [--changelog CHANGELOG.md]
 * Writes UTF-8 to the file (never relies on the console encoding – Windows runners use cp1252).
 */
import fs from "node:fs";
import path from "node:path";

/** Release notes for `version` ("1.2.0" or "v1.2.0") from the changelog text; the fallback when the section is missing. */
export function releaseNotes(changelog: string, version: string): { text: string; found: boolean } {
  const v = version.replace(/^v/, "").trim();
  const lines = changelog.replace(/\r/g, "").split("\n");
  const isHeading = (l: string) => /^##\s+/.test(l);
  const start = lines.findIndex((l) => {
    const m = /^##\s+v?(\d+\.\d+\.\d+)\b/.exec(l);
    return !!m && m[1] === v;
  });
  if (start < 0) {
    return { text: `${v} kiadás. A változások listája: CHANGELOG.md.`, found: false };
  }
  const body: string[] = [];
  for (let i = start + 1; i < lines.length && !isHeading(lines[i] ?? ""); i++) body.push(lines[i] ?? "");
  const text = body.join("\n").trim();
  return { text: text || `${v} kiadás.`, found: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const version = args.find((a) => !a.startsWith("--"));
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!version) {
    console.error("Használat: tsx scripts/desktop/release-notes.ts <verzió> [--out <fájl>] [--changelog CHANGELOG.md]");
    process.exit(2);
  }
  const file = opt("--changelog") ?? path.join(process.cwd(), "CHANGELOG.md");
  const { text, found } = releaseNotes(fs.readFileSync(file, "utf8"), version);
  const out = opt("--out");
  if (out) {
    fs.writeFileSync(out, text + "\n", "utf8");
    console.log(`${found ? "✓" : "⚠ nincs ilyen szakasz a CHANGELOG-ban –"} kiadás-jegyzet: ${out} (${text.length} karakter)`);
  } else {
    process.stdout.write(Buffer.from(text + "\n", "utf8"));
  }
  if (!found) process.exitCode = 0;
}

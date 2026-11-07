/**
 * Prepares a release: bumps the version in package.json / package-lock.json,
 * turns the "Kiadatlan" section of CHANGELOG.md into the version's section
 * (dated today) and opens a fresh empty "Kiadatlan" above it.
 *
 * Usage: npm run release -- 1.2.0 [--commit] [--tag]
 *   --commit   git commit the two files ("Kiadás: v1.2.0")
 *   --tag      also create the tag v1.2.0 (push it with `git push origin v1.2.0` → GitHub Actions builds and publishes)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The changelog with "## Kiadatlan" renamed to the version section and a new empty "Kiadatlan" on top. */
export function rollChangelog(changelog: string, version: string, date: string): string {
  const v = version.replace(/^v/, "");
  const text = changelog.replace(/\r/g, "");
  const re = /^##\s+Kiadatlan.*$/m;
  if (!re.test(text)) throw new Error('A CHANGELOG.md-ben nincs "## Kiadatlan" szakasz.');
  if (new RegExp(`^##\\s+v?${v.replace(/\./g, "\\.")}\\b`, "m").test(text)) throw new Error(`A ${v} verzió már szerepel a CHANGELOG.md-ben.`);
  return text.replace(re, `## Kiadatlan\n\n_(még nincs kiadatlan változás)_\n\n## ${v} – ${date}`).replace(/\n{3,}/g, "\n\n");
}

export function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const version = (args.find((a) => !a.startsWith("--")) ?? "").replace(/^v/, "");
  if (!isSemver(version)) {
    console.error("Használat: npm run release -- <X.Y.Z> [--commit] [--tag]");
    process.exit(2);
  }
  const root = process.cwd();
  const changelogFile = path.join(root, "CHANGELOG.md");
  const date = new Date().toISOString().slice(0, 10);
  const rolled = rollChangelog(fs.readFileSync(changelogFile, "utf8"), version, date);
  // remove the placeholder from the section that just became the release
  const cleaned = rolled.replace(`## ${version} – ${date}\n\n_(még nincs kiadatlan változás)_\n`, `## ${version} – ${date}\n`);
  fs.writeFileSync(changelogFile, cleaned, "utf8");
  const npm = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { stdio: "inherit", shell: process.platform === "win32" });
  if (npm.status !== 0) process.exit(npm.status ?? 1);
  console.log(`✓ package.json → ${version}, CHANGELOG.md: "## ${version} – ${date}"`);
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  if (args.includes("--commit")) {
    git("add", "package.json", "package-lock.json", "CHANGELOG.md");
    git("commit", "-m", `Kiadás: v${version}`);
    console.log(`✓ commit: Kiadás: v${version}`);
  }
  if (args.includes("--tag")) {
    git("tag", "-a", `v${version}`, "-m", `v${version}`);
    console.log(`✓ címke: v${version}\n\nKiadás: git push origin HEAD && git push origin v${version}  →  a GitHub Actions legyártja és kiteszi a telepítőket.`);
  } else {
    console.log(`\nKövetkező lépés: git tag -a v${version} -m v${version} && git push origin v${version}  (vagy: Actions → release → Run workflow → version: ${version})`);
  }
}

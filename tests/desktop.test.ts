import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { releaseNotes } from "../scripts/desktop/release-notes";
import { isSemver, rollChangelog } from "../scripts/release";
import { plainMarkdown } from "@/components/desktop/UpdateBar";
import { megabytes } from "@/components/desktop/bridge";
import { DESKTOP_PATH_KINDS, IPC } from "@/desktop/shared";
import { t } from "@/lib/i18n/hu";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const pkg = JSON.parse(read("package.json")) as { version: string; main: string; repository: { url: string }; scripts: Record<string, string>; devDependencies: Record<string, string> };

/** Guards for the desktop app: the pieces that must agree with each other. */
describe("desktop app wiring", () => {
  it("package.json points Electron at the bundled main process and names the GitHub repository", () => {
    expect(pkg.main).toBe("desktop/dist/main.cjs");
    expect(pkg.repository.url).toBe("https://github.com/David-Getta/Angol-erettsegi.git");
    for (const s of ["desktop:bundle", "desktop:dev", "desktop:build", "desktop:dist", "desktop:smoke", "release", "release:notes"]) expect(pkg.scripts[s], s).toBeTruthy();
    expect(pkg.devDependencies.electron).toBeTruthy();
    expect(pkg.devDependencies["electron-updater"]).toBeTruthy();
    expect(pkg.devDependencies["electron-builder"]).toBeTruthy();
  });

  it("electron-builder publishes to the same repository the updater and package.json name", () => {
    const yml = read("electron-builder.yml");
    expect(yml).toMatch(/provider: github\n\s+owner: David-Getta\n\s+repo: Angol-erettsegi/);
    const main = read("desktop/main.ts");
    expect(main).toContain('owner: "David-Getta", repo: "Angol-erettsegi"');
    // the packaged app ships the server, content, config, migrations and the command docs
    for (const res of ["from: desktop/dist", 'filter: ["server/**/*"]', "from: content", "from: config", "from: drizzle", "from: .claude/commands"]) expect(yml).toContain(res);
    // the root node_modules must stay out of the asar (the server has its own Electron-ABI copy)
    expect(yml).toContain('"!node_modules/**"');
    expect(yml).toContain("npmRebuild: false");
    // per-user Windows install so the silent update can replace the files without admin rights
    expect(yml).toMatch(/perMachine: false/);
    expect(yml).toMatch(/oneClick: false/);
    // an unsigned arm64 app would not even start on Apple Silicon: ad-hoc signature
    expect(yml).toContain('identity: "-"');
  });

  it("the Electron version has a prebuilt better-sqlite3 binary (the build fetches it instead of compiling)", () => {
    // Electron 39–42 (ABI 140–146) ship with better-sqlite3 12.x prebuilds; newer majors do not yet.
    const electron = JSON.parse(read("node_modules/electron/package.json")) as { version: string };
    const major = Number(electron.version.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(39);
    expect(major).toBeLessThanOrEqual(42);
    const declared = Number(((pkg.devDependencies.electron ?? "").match(/\d+/) ?? ["0"])[0]);
    expect(declared).toBe(major);
  });

  it("the preload exposes every IPC channel the main process handles", () => {
    const main = read("desktop/main.ts");
    const preload = read("desktop/preload.ts");
    for (const [key, channel] of Object.entries(IPC)) {
      if (key === "updateEvent") {
        expect(main).toContain("IPC.updateEvent");
        expect(preload).toContain("IPC.updateEvent");
        continue;
      }
      expect(main, channel).toContain(`ipcMain.handle(IPC.${key}`);
      expect(preload, channel).toContain(`IPC.${key}`);
    }
    expect(DESKTOP_PATH_KINDS).toEqual(["data", "exchange", "logs"]);
  });

  it("the Next server is built standalone for the desktop app and seeds itself on start", () => {
    expect(read("next.config.ts")).toContain('process.env.DESKTOP_BUILD === "1" ? "standalone"');
    const instr = read("instrumentation.ts");
    expect(instr).toContain('process.env.APP_SEED_ON_START !== "1"');
    expect(read("desktop/main.ts")).toContain('APP_SEED_ON_START: "1"');
    // the window waits for this route
    expect(read("app/api/health/route.ts")).toContain("ok: true");
    expect(read("instrumentation.ts")).toContain("watchParent(");
    expect(read("desktop/main.ts")).toContain("/api/health");
  });

  it("the release workflow builds on v* tags or a manual version and publishes the updater descriptors", () => {
    const wf = read(".github/workflows/release.yml");
    expect(wf).toContain('tags: ["v*"]');
    expect(wf).toContain("workflow_dispatch");
    expect(wf).toContain("npm run desktop:dist");
    expect(wf).toContain("npm run desktop:smoke");
    expect(wf).toContain("target_commitish: ${{ github.sha }}");
    expect(wf).toContain("concurrency:");
    expect(wf).toContain("release-files/latest*.yml");
    expect(wf).toContain("softprops/action-gh-release@v2");
    // the release body comes from the CHANGELOG through a file (UTF-8), never via console redirection
    expect(wf).toContain("release:notes");
    expect(wf).toContain("--out release_notes.md");
    expect(wf).toContain("body_path: release_notes.md");
    expect(wf).toContain("npm version");
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("npm run check");
    expect(ci).toContain("npm run desktop:bundle");
  });

  it("the changelog has an unreleased section and the UI strings exist", () => {
    expect(read("CHANGELOG.md")).toMatch(/^## Kiadatlan/m);
    expect(t.desktop.updateNow).toBe("Frissítés most");
    expect(t.desktop.later).toBe("Később");
    expect(t.desktop.available("1.2.0")).toContain("1.2.0");
    expect(t.speaking.noAsrDesktop).toContain("böngésző");
    expect(read("TELEPITES.md")).toContain("Frissítés most");
  });
});

describe("release notes from the changelog", () => {
  const changelog = `# Változásnapló

## Kiadatlan

- valami új

## 1.2.0 – 2026-11-20

- **Első.** Egy változás.
- Második változás.

## 1.1.0 – 2026-11-10

- régi
`;
  it("returns the section of the requested version only", () => {
    const r = releaseNotes(changelog, "1.2.0");
    expect(r.found).toBe(true);
    expect(r.text).toBe("- **Első.** Egy változás.\n- Második változás.");
    expect(releaseNotes(changelog, "v1.1.0").text).toBe("- régi");
  });
  it("falls back to a short text when the version is missing", () => {
    const r = releaseNotes(changelog, "9.9.9");
    expect(r.found).toBe(false);
    expect(r.text).toContain("9.9.9");
  });
  it("rolls the unreleased section into a dated version section", () => {
    const rolled = rollChangelog(changelog, "1.3.0", "2026-12-01");
    expect(rolled).toContain("## Kiadatlan\n\n_(még nincs kiadatlan változás)_\n\n## 1.3.0 – 2026-12-01\n\n- valami új");
    expect(releaseNotes(rolled, "1.3.0").text).toBe("- valami új");
    expect(() => rollChangelog(changelog, "1.2.0", "2026-12-01")).toThrow(/már szerepel/);
    expect(() => rollChangelog("# x\n\n## 1.0.0\n", "1.0.1", "2026-12-01")).toThrow(/Kiadatlan/);
  });
  it("accepts only X.Y.Z versions", () => {
    expect(isSemver("1.0.0")).toBe(true);
    expect(isSemver("v1.0.0")).toBe(false);
    expect(isSemver("1.0")).toBe(false);
  });
});

describe("update banner helpers", () => {
  it("renders release-note markdown as plain text", () => {
    expect(plainMarkdown("## Cím\n\n- **Félkövér** és `kód` [link](https://x)\n\n\n\n* másik")).toBe("Cím\n\n• Félkövér és kód link\n• másik");
  });
  it("renders the HTML the public GitHub provider delivers as plain text", () => {
    const html = "<h2>Cím</h2>\n<ul>\n<li><strong>Első.</strong> Egy &amp; kettő</li>\n<li>Második<br>sor</li>\n</ul>\n<p>Vége.</p>";
    expect(plainMarkdown(html)).toBe("Cím\n\n• Első. Egy & kettő\n• Második\nsor\n\nVége.");
  });
  it("shows whole megabytes, never zero", () => {
    expect(megabytes(null)).toBeNull();
    expect(megabytes(0)).toBeNull();
    expect(megabytes(100)).toBe(1);
    expect(megabytes(95 * 1024 * 1024)).toBe(95);
  });
});

/**
 * Starts the built desktop app (desktop/out/<platform>-unpacked) with --smoke-test:
 * it boots the bundled server in a temporary data folder, opens the window,
 * takes a screenshot and prints a JSON line. Exit code 0 = the app works.
 * On Linux without a display it runs under xvfb-run when available.
 *
 * Usage: tsx scripts/desktop/smoke.ts [--shot desktop/out/smoke.png]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "desktop", "out");
const args = process.argv.slice(2);
const shotIdx = args.indexOf("--shot");
const shot = shotIdx >= 0 ? path.resolve(args[shotIdx + 1] ?? path.join(OUT, "smoke.png")) : path.join(OUT, "smoke.png");

function executable(): string {
  const candidates =
    process.platform === "win32"
      ? [path.join(OUT, "win-unpacked", "ErettsegiFelkeszito.exe")]
      : process.platform === "darwin"
        ? // desktop/out/mac*/<productName>.app/Contents/MacOS/<executable> – whatever electron-builder named them;
          // the folder of this machine's architecture first (mac-arm64 on Apple Silicon, mac = x64), the other
          // one would need Rosetta and dies with a signal
          (fs.existsSync(OUT) ? fs.readdirSync(OUT) : [])
            .filter((d) => d.startsWith("mac"))
            .sort((a, b) => Number(b === (process.arch === "arm64" ? "mac-arm64" : "mac")) - Number(a === (process.arch === "arm64" ? "mac-arm64" : "mac")))
            .flatMap((d) =>
              fs
                .readdirSync(path.join(OUT, d))
                .filter((a) => a.endsWith(".app"))
                .flatMap((a) => {
                  const bin = path.join(OUT, d, a, "Contents", "MacOS");
                  return fs.existsSync(bin) ? fs.readdirSync(bin).map((f) => path.join(bin, f)) : [];
                }),
            )
        : [path.join(OUT, "linux-unpacked", "ErettsegiFelkeszito")];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) {
    console.error(`✖ nincs kicsomagolt app (npm run desktop:build): ${candidates.join(", ")}`);
    process.exit(1);
  }
  return found;
}

/** When the app died on macOS: code signature state and the newest crash report (signal, exception type). */
function diagnoseMac(bin: string): void {
  const app = bin.replace(/\/Contents\/MacOS\/[^/]+$/, "");
  const show = (title: string, cmd: string, cmdArgs: string[]) => {
    const x = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 30_000 });
    console.error(`--- ${title} (${x.status})\n${(x.stdout ?? "").slice(0, 2000)}${(x.stderr ?? "").slice(0, 2000)}`);
  };
  show("codesign --verify", "codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  show("codesign -d", "codesign", ["-dv", "--verbose=2", app]);
  show("ls MacOS", "ls", ["-la", path.join(app, "Contents", "MacOS")]);
  show("ls Frameworks", "ls", ["-la", path.join(app, "Contents", "Frameworks")]);
  show("plist", "plutil", ["-p", path.join(app, "Contents", "Info.plist")]);
  // Chromium logs nothing to stderr in a packaged app unless asked; a CHECK failure shows up here
  const v = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 30_000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1", ELECTRON_ENABLE_STACK_DUMPING: "1" } });
  console.error(`--- version (${v.status}, jel ${v.signal ?? "-"})\n${(v.stdout ?? "").slice(0, 2000)}${(v.stderr ?? "").slice(0, 4000)}`);
  // fuse state: an enabled asar-integrity fuse with a stale hash kills the app with SIGTRAP before any log line
  show("fuses", path.join(ROOT, "node_modules", ".bin", "electron-fuses"), ["read", "--app", app]);
  const lg = spawnSync("log", ["show", "--last", "2m", "--style", "compact", "--predicate", 'process CONTAINS "rettsegi" OR process CONTAINS "Erettsegi" OR eventMessage CONTAINS "rettsegi" OR eventMessage CONTAINS "asar" OR eventMessage CONTAINS "Electron"'], { encoding: "utf8", timeout: 60_000 });
  console.error(`--- system log (${lg.status}, last part)\n${(lg.stdout ?? "").slice(-4000)}${(lg.stderr ?? "").slice(-500)}`);
  // Experiments without rebuilding: does vanilla Electron run here, does a plain ad-hoc re-sign help,
  // does an ASCII executable name help (the product name is accented).
  const run = (title: string, cmd: string, cmdArgs: string[]) => {
    const x = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 60_000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" } });
    console.error(`--- ${title}: status ${x.status}, jel ${x.signal ?? "-"}\n${(x.stdout ?? "").slice(0, 600)}${(x.stderr ?? "").slice(-1500)}`);
  };
  const vanilla = path.join(ROOT, "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", "Electron");
  if (fs.existsSync(vanilla)) run("vanilla Electron --version", vanilla, ["--version"]);
  const copy = path.join(os.tmpdir(), "ErettsegiFelkeszito.app");
  fs.rmSync(copy, { recursive: true, force: true });
  spawnSync("cp", ["-R", app, copy]);
  show("re-sign plain ad-hoc", "codesign", ["--force", "--deep", "-s", "-", copy]);
  run("copy, plain ad-hoc, accented name --version", path.join(copy, "Contents", "MacOS", path.basename(bin)), ["--version"]);
  const macos = path.join(copy, "Contents", "MacOS");
  fs.renameSync(path.join(macos, path.basename(bin)), path.join(macos, "ErettsegiFelkeszito"));
  show("plist executable → ASCII", "plutil", ["-replace", "CFBundleExecutable", "-string", "ErettsegiFelkeszito", path.join(copy, "Contents", "Info.plist")]);
  show("re-sign", "codesign", ["--force", "--deep", "-s", "-", copy]);
  run("copy, ASCII executable --version", path.join(macos, "ErettsegiFelkeszito"), ["--version"]);
  run("copy, ASCII executable smoke", path.join(macos, "ErettsegiFelkeszito"), [`--smoke-test`, `--data-dir=${path.join(os.tmpdir(), "erettsegi-exp", "data")}`, `--exchange-dir=${path.join(os.tmpdir(), "erettsegi-exp", "exchange")}`]);
  // the crash reporter writes its file a few seconds after the crash
  spawnSync("sleep", ["10"]);
  for (const reports of [path.join(os.homedir(), "Library", "Logs", "DiagnosticReports"), "/Library/Logs/DiagnosticReports"]) {
    if (!fs.existsSync(reports)) continue;
    const ours = fs
      .readdirSync(reports)
      .filter((f) => /\.(ips|crash)$/.test(f) && /rettsegi|Erettsegi|Electron/i.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(reports, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];
    if (ours) console.error(`--- crash report ${ours.f}\n${fs.readFileSync(path.join(reports, ours.f), "utf8").slice(0, 6000)}`);
    else console.error(`--- nincs saját összeomlás-jelentés (${reports}): ${fs.readdirSync(reports).slice(-5).join(", ")}`);
  }
}

const exe = executable();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "erettsegi-smoke-"));
const appArgs = [`--smoke-test=${shot}`, `--data-dir=${path.join(tmp, "data")}`, `--exchange-dir=${path.join(tmp, "exchange")}`];
if (process.platform === "linux") appArgs.unshift("--no-sandbox");
const useXvfb = process.platform === "linux" && !process.env.DISPLAY && spawnSync("which", ["xvfb-run"]).status === 0;
const cmd = useXvfb ? "xvfb-run" : exe;
const cmdArgs = useXvfb ? ["--auto-servernum", "--server-args=-screen 0 1400x900x24", exe, ...appArgs] : appArgs;
console.log(`$ ${[cmd, ...cmdArgs].join(" ")}`);
const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 180_000, env: { ...process.env } });
const lines = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("{"));
const last = lines[lines.length - 1];
let result: { ok?: boolean; error?: string; title?: string; subjects?: number; url?: string; version?: string } = {};
try {
  result = last ? JSON.parse(last) : {};
} catch {
  /* no JSON line */
}
if (r.status !== 0 || !result.ok) {
  console.error(`✖ a füstteszt elbukott (kilépési kód ${r.status}, jel ${r.signal ?? "-"}${r.error ? `, hiba: ${r.error.message}` : ""})`);
  console.error(result.error ?? "");
  console.error((r.stdout ?? "").slice(-3000));
  console.error((r.stderr ?? "").slice(-3000));
  if (process.platform === "darwin") diagnoseMac(exe);
  process.exit(1);
}
console.log(`✓ az app elindult: ${result.title} (${result.version}) – ${result.subjects} tantárgy a kezdőképernyőn, ${result.url}`);
if (fs.existsSync(shot)) console.log(`  képernyőkép: ${path.relative(ROOT, shot)}`);
fs.rmSync(tmp, { recursive: true, force: true });

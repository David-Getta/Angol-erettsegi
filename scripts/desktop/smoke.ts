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

const exe = executable();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "erettsegi-smoke-"));
const appArgs = [`--smoke-test=${shot}`, `--data-dir=${path.join(tmp, "data")}`, `--exchange-dir=${path.join(tmp, "exchange")}`];
if (process.platform === "linux") appArgs.unshift("--no-sandbox");
const useXvfb = process.platform === "linux" && !process.env.DISPLAY && spawnSync("which", ["xvfb-run"]).status === 0;
const cmd = useXvfb ? "xvfb-run" : exe;
const cmdArgs = useXvfb ? ["--auto-servernum", "--server-args=-screen 0 1400x900x24", exe, ...appArgs] : appArgs;
console.log(`$ ${[cmd, ...cmdArgs].join(" ")}`);
const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 180_000, env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" } });
const lines = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("{"));
const last = lines[lines.length - 1];
let result: { ok?: boolean; error?: string; title?: string; subjects?: number; url?: string; version?: string } = {};
try {
  result = last ? JSON.parse(last) : {};
} catch {
  /* no JSON line */
}
if (r.status !== 0 || !result.ok) {
  console.error(`✖ a füstteszt elbukott (kilépési kód ${r.status})`);
  console.error(result.error ?? "");
  console.error((r.stdout ?? "").slice(-3000));
  console.error((r.stderr ?? "").slice(-3000));
  process.exit(1);
}
console.log(`✓ az app elindult: ${result.title} (${result.version}) – ${result.subjects} tantárgy a kezdőképernyőn, ${result.url}`);
if (fs.existsSync(shot)) console.log(`  képernyőkép: ${path.relative(ROOT, shot)}`);
fs.rmSync(tmp, { recursive: true, force: true });

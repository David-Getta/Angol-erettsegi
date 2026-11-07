/**
 * Builds the desktop app:
 *   1. `next build` in standalone mode (DESKTOP_BUILD=1, dist folder .next-desktop)
 *   2. assembles desktop/dist/server/ (standalone server + static files + public/)
 *   3. swaps better-sqlite3's native binary for the Electron-ABI prebuilt one and loads it once as a check
 *   4. bundles the Electron main/preload (esbuild)
 *   5. runs electron-builder (installers into desktop/out/, or the unpacked folder with --dir)
 *
 * Usage: tsx scripts/desktop/build.ts [--dir] [--skip-next] [--win|--mac|--linux] [--publish never|always]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundleDesktop } from "./bundle";

const ROOT = process.cwd();
const DIST_DIR = ".next-desktop";
const SERVER_DIR = path.join(ROOT, "desktop", "dist", "server");
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

function run(cmd: string, cmdArgs: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): void {
  const shown = [cmd, ...cmdArgs].join(" ");
  console.log(`\n$ ${shown}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: opts.cwd ?? ROOT, env: { ...process.env, ...opts.env }, shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`✖ sikertelen (${r.status}): ${shown}`);
    process.exit(r.status ?? 1);
  }
}

const bin = (name: string) => path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

function electronVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "electron", "package.json"), "utf8")) as { version: string };
  return pkg.version;
}

function copyDir(from: string, to: string): void {
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
}

/**
 * Next's standalone output links its externals (`.next-desktop/node_modules/better-sqlite3-<hash>` →
 * `../../node_modules/better-sqlite3`). Links survive badly in installers and on Windows, and an absolute
 * one would point back at the build machine, so every link inside the copy becomes a real copy of its
 * target (the target is mapped into the copy when it points at the original standalone folder).
 */
function materializeSymlinks(dir: string, original: string): number {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let target = fs.readlinkSync(p);
      if (!path.isAbsolute(target)) target = path.resolve(path.dirname(p), target);
      if (target.startsWith(original)) target = path.join(SERVER_DIR, path.relative(original, target));
      if (!fs.existsSync(target)) {
        console.error(`✖ a standalone csomag hivatkozása sehová sem mutat: ${p} → ${target}`);
        process.exit(1);
      }
      fs.rmSync(p);
      fs.cpSync(target, p, { recursive: true, verbatimSymlinks: true });
      n++;
    } else if (entry.isDirectory()) {
      n += materializeSymlinks(p, original);
    }
  }
  return n;
}

/** 1 + 2: the standalone server folder the Electron shell starts. */
function assembleServer(): void {
  const standalone = path.join(ROOT, DIST_DIR, "standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    console.error(`✖ nincs standalone build: ${standalone} (futtasd --skip-next nélkül)`);
    process.exit(1);
  }
  fs.rmSync(SERVER_DIR, { recursive: true, force: true });
  fs.mkdirSync(SERVER_DIR, { recursive: true });
  copyDir(standalone, SERVER_DIR);
  copyDir(path.join(ROOT, DIST_DIR, "static"), path.join(SERVER_DIR, DIST_DIR, "static"));
  if (fs.existsSync(path.join(ROOT, "public"))) copyDir(path.join(ROOT, "public"), path.join(SERVER_DIR, "public"));
  // the standalone copy must not carry a stale dev database or exchange folder, nor its own copy of the
  // content/config/migrations – the shell points the server at resources/{content,config,drizzle} instead
  for (const d of ["data", "exchange", ".env", ".env.local", "content", "config", "drizzle"]) fs.rmSync(path.join(SERVER_DIR, d), { recursive: true, force: true });
  console.log(`✓ szerver összeállítva: ${path.relative(ROOT, SERVER_DIR)}`);
}

/** Downloads the prebuilt better-sqlite3 binary for Electron into `dir` (platform/arch given) and returns its path. */
function fetchPrebuild(dir: string, ev: string, platform: string, arch: string): string {
  fs.rmSync(path.join(dir, "build"), { recursive: true, force: true });
  run(bin("prebuild-install"), [`--runtime=electron`, `--target=${ev}`, `--platform=${platform}`, `--arch=${arch}`, "--verbose"], { cwd: dir });
  const release = path.join(dir, "build", "Release");
  const node = fs.readdirSync(release).find((f) => f.endsWith(".node"));
  if (!node) {
    console.error("✖ a prebuild-install nem hozott létre .node fájlt");
    process.exit(1);
  }
  return path.join(release, node);
}

/**
 * 3: better-sqlite3 compiled for Node cannot load inside Electron – fetch the prebuilt Electron binary.
 * On macOS the same server folder goes into both the arm64 and the x64 app, so the two prebuilds are
 * merged into one universal binary with lipo.
 */
function nativeForElectron(platform: string, arch: string): void {
  const dir = path.join(SERVER_DIR, "node_modules", "better-sqlite3");
  if (!fs.existsSync(dir)) {
    console.error(`✖ a standalone csomagban nincs better-sqlite3: ${dir}`);
    process.exit(1);
  }
  const ev = electronVersion();
  let node: string;
  if (platform === "darwin") {
    const arm = fetchPrebuild(dir, ev, platform, "arm64");
    const armCopy = `${arm}.arm64`;
    fs.renameSync(arm, armCopy);
    const x64 = fetchPrebuild(dir, ev, platform, "x64");
    const x64Copy = `${x64}.x64`;
    fs.renameSync(x64, x64Copy);
    node = x64;
    run("lipo", ["-create", "-output", node, armCopy, x64Copy]);
    fs.rmSync(armCopy);
    fs.rmSync(x64Copy);
    console.log(`✓ better-sqlite3 Electron ${ev} (darwin universal arm64+x64): build/Release/${path.basename(node)}`);
  } else {
    node = fetchPrebuild(dir, ev, platform, arch);
    console.log(`✓ better-sqlite3 Electron ${ev} (${platform}-${arch}): build/Release/${path.basename(node)}`);
  }
  // Load it once in Electron's Node to be sure the ABI matches (only when building for this machine).
  if (platform === process.platform && (platform === "darwin" || arch === process.arch)) {
    const electron = path.join(ROOT, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron");
    const check = spawnSync(electron, ["-e", `const D=require(${JSON.stringify(dir)});const db=new D(":memory:");console.log("better-sqlite3 OK, sqlite", db.prepare("select sqlite_version() v").get().v)`], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
    });
    if (check.status !== 0) {
      console.error(`✖ a natív modul nem töltődik be az Electronban:\n${check.stderr}`);
      process.exit(1);
    }
    console.log(`✓ ${check.stdout.trim()}`);
  }
}

async function main(): Promise<void> {
  const platform = has("--win") ? "win32" : has("--mac") ? "darwin" : has("--linux") ? "linux" : process.platform;
  const arch = value("--arch") ?? (platform === "darwin" ? process.arch : "x64");
  if (platform !== process.platform) {
    console.error("✖ a csomagot az adott rendszeren kell építeni (Windows-telepítő Windowson, macOS-app macOS-en)");
    process.exit(1);
  }
  if (!has("--skip-next")) {
    run(bin("next"), ["build"], { env: { DESKTOP_BUILD: "1", NEXT_DIST_DIR: DIST_DIR, NEXT_TELEMETRY_DISABLED: "1" } });
  }
  assembleServer();
  nativeForElectron(platform, arch);
  // after the native swap, so the copies made of the links carry the Electron binary too
  const links = materializeSymlinks(SERVER_DIR, path.join(ROOT, DIST_DIR, "standalone"));
  console.log(`✓ ${links} hivatkozás másolattá alakítva a szerver mappában`);
  const bundled = await bundleDesktop(ROOT);
  console.log(`✓ Electron-csomag: ${bundled.map((f) => path.relative(ROOT, f)).join(", ")}`);
  const eb = ["--config", "electron-builder.yml"];
  if (has("--dir")) eb.push("--dir");
  if (platform === "win32") eb.push("--win");
  if (platform === "darwin") eb.push("--mac");
  if (platform === "linux") eb.push("--linux");
  eb.push("--publish", value("--publish") ?? "never");
  run(bin("electron-builder"), eb, { env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" } });
  const out = path.join(ROOT, "desktop", "out");
  const files = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /\.(exe|dmg|zip|AppImage|yml|blockmap)$/.test(f)) : [];
  console.log(`\n✓ Kész (${os.platform()} ${arch}): ${path.relative(ROOT, out)}/${files.length ? "\n  " + files.join("\n  ") : " (kicsomagolt mappa)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

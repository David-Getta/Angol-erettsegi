/**
 * Electron main process of the installed desktop app.
 *
 * The app is a thin shell: it starts the bundled Next.js server ("motor") as a
 * child process on a free localhost port, opens it in a window, and keeps
 * itself up to date from the GitHub Releases of the repository (electron-updater).
 *
 * Nothing here calls any AI API; the server is the same app as `npm run dev`,
 * pointed at the user's own data folder.
 *
 * Command line (all optional):
 *   --dev-url=http://localhost:3000   use a running dev server instead of the bundled one
 *   --data-dir=<folder>               where the database and backups live (default: app data)
 *   --exchange-dir=<folder>           the exchange folder (default: Documents/Érettségi felkészítő/exchange)
 *   --smoke-test[=<screenshot.png>]   start, wait for the page, print a JSON line and exit (CI)
 */
import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, safeStorage, screen, shell, type MenuItemConstructorOptions } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { t } from "../lib/i18n/hu";
import { DESKTOP_PATH_KINDS, IPC, type DesktopInfo, type DesktopPathKind, type UpdateState } from "./shared";

/** The GitHub repository whose Releases carry the installers (electron-builder.yml → publish). */
export const GITHUB = { owner: "David-Getta", repo: "Angol-erettsegi" } as const;
const RELEASES_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/releases/latest`;
const INSTALL_GUIDE_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/blob/main/TELEPITES.md`;
const ISSUES_URL = `https://github.com/${GITHUB.owner}/${GITHUB.repo}/issues`;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SERVER_START_TIMEOUT_MS = 120_000;

/* ---------------------------------------------------------------- CLI */

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const i = process.argv.indexOf(name);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  return next && !next.startsWith("--") ? next : null;
}
const hasFlag = (name: string) => process.argv.some((a) => a === name || a.startsWith(`${name}=`));

const DEV_URL = argValue("--dev-url");
const SMOKE = hasFlag("--smoke-test");
const SMOKE_SHOT = argValue("--smoke-test");

// Chromium's Linux text-to-speech backend is off unless asked for (the listening tasks read aloud).
if (process.platform === "linux") app.commandLine.appendSwitch("enable-speech-dispatcher");
// electron-updater would prefer these over the key saved in the app (developer shells, CI).
delete process.env.GH_TOKEN;
delete process.env.GITHUB_TOKEN;

/* -------------------------------------------------------------- paths */

/** Repository root when running unpackaged (desktop/dist/main.cjs → ../..). */
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RESOURCES = app.isPackaged ? process.resourcesPath : REPO_ROOT;

// A stable, accent-free folder name for the per-user data, whatever the product name is.
app.setPath("userData", path.join(app.getPath("appData"), "erettsegi-felkeszito"));
const USER_DATA = app.getPath("userData");
const LOG_DIR = path.join(USER_DATA, "logs");
const SETTINGS_FILE = path.join(USER_DATA, "desktop-settings.json");

type DesktopSettings = {
  exchangeDir?: string;
  /** base64 of the safeStorage-encrypted token, or the plain token when encryption is unavailable (plain: true). */
  updateToken?: string;
  updateTokenPlain?: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number; maximized?: boolean };
};

function readSettings(): DesktopSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as DesktopSettings;
  } catch {
    return {};
  }
}
function writeSettings(patch: Partial<DesktopSettings>): DesktopSettings {
  const next = { ...readSettings(), ...patch };
  for (const k of Object.keys(next) as (keyof DesktopSettings)[]) if (next[k] === undefined) delete next[k];
  fs.mkdirSync(USER_DATA, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

function dataDir(): string {
  return argValue("--data-dir") ?? path.join(USER_DATA, "data");
}
let exchangeFallback: string | null = null;
function exchangeDir(): string {
  return exchangeFallback ?? argValue("--exchange-dir") ?? readSettings().exchangeDir ?? path.join(app.getPath("documents"), "Érettségi felkészítő", "exchange");
}
/** Creates the folder; when the chosen one cannot be created (e.g. macOS denied access to Documents) the app falls back to its own data folder. */
function ensureExchangeDir(): string {
  const wanted = exchangeDir();
  try {
    fs.mkdirSync(wanted, { recursive: true });
    return wanted;
  } catch (e) {
    const fallback = path.join(USER_DATA, "exchange");
    log(`a beadás-mappa nem hozható létre (${wanted}): ${(e as Error).message} – helyette: ${fallback}`);
    fs.mkdirSync(fallback, { recursive: true });
    exchangeFallback = fallback;
    return fallback;
  }
}
function serverDir(): string {
  return app.isPackaged ? path.join(RESOURCES, "server") : path.join(REPO_ROOT, "desktop", "dist", "server");
}

/* ------------------------------------------------------------ logging */

function appendLog(file: string, line: string): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const p = path.join(LOG_DIR, file);
    try {
      if (fs.statSync(p).size > 2 * 1024 * 1024) fs.renameSync(p, `${p}.1`);
    } catch {
      /* no file yet */
    }
    fs.appendFileSync(p, line.endsWith("\n") ? line : `${line}\n`, "utf8");
  } catch {
    /* logging must never break the app */
  }
}
const log = (msg: string) => {
  const line = `${new Date().toISOString()} ${msg}`;
  appendLog("desktop.log", line);
  if (!app.isPackaged || SMOKE) console.log(line);
};

/* ------------------------------------------------------------- server */

function freePort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => {
      if (preferred) resolve(freePort());
      else reject(new Error("no free port"));
    });
    srv.listen(preferred ?? 0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function health(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The bundled Next.js server as a child process (Electron's own Node runtime, ELECTRON_RUN_AS_NODE). */
class LocalServer {
  child: ChildProcess | null = null;
  url = "";
  port = 0;
  /** Called when the server dies on its own (not stopped by us). */
  onCrash: ((code: number | null) => void) | null = null;
  private stopping = false;

  async start(onStatus: (s: string) => void): Promise<string> {
    if (DEV_URL) {
      this.url = DEV_URL.replace(/\/$/, "");
      onStatus(t.desktop.splash.starting);
      for (let i = 0; i < 200; i++) {
        if (await health(this.url)) return this.url;
        await sleep(500);
      }
      throw new Error(`a fejlesztői szerver nem válaszol: ${this.url}`);
    }
    const dir = serverDir();
    const entry = path.join(dir, "server.js");
    if (!fs.existsSync(entry)) throw new Error(`hiányzik a szerver: ${entry}`);
    this.port = await freePort(this.port || undefined);
    this.url = `http://127.0.0.1:${this.port}`;
    for (const d of [dataDir(), LOG_DIR]) fs.mkdirSync(d, { recursive: true });
    ensureExchangeDir();
    this.stopping = false;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(this.port),
      HOSTNAME: "127.0.0.1",
      APP_ROOT: RESOURCES,
      APP_CONFIG_DIR: path.join(RESOURCES, "config"),
      APP_CONTENT_DIR: path.join(RESOURCES, "content"),
      APP_DATA_DIR: dataDir(),
      APP_EXCHANGE_DIR: exchangeDir(),
      APP_SEED_ON_START: "1",
      APP_VERSION: app.getVersion(),
      // the server exits by itself when the shell disappears (crash, Task Manager), see lib/startup.ts
      APP_PARENT_PID: String(process.pid),
      NEXT_TELEMETRY_DISABLED: "1",
    };
    // a globally set NODE_OPTIONS would make the packaged Electron warn and ignore it; the server needs none
    delete env.NODE_OPTIONS;
    delete env.ELECTRON_NO_ASAR;
    log(`szerver indul: ${entry} → ${this.url} (adat: ${dataDir()}, exchange: ${exchangeDir()})`);
    const child = spawn(process.execPath, [entry], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    const pipe = (stream: NodeJS.ReadableStream | null) =>
      stream?.on("data", (chunk: Buffer) => appendLog("server.log", chunk.toString("utf8").replace(/\s+$/, "")));
    pipe(child.stdout);
    pipe(child.stderr);
    let exited: number | null = null;
    let started = false;
    child.on("error", (e) => {
      exited = -1;
      log(`a szerver nem indítható: ${e.message}`);
      if (this.child === child) this.child = null;
    });
    child.on("exit", (code) => {
      exited = code ?? -1;
      log(`a szerver kilépett (${code})`);
      const mine = this.child === child;
      if (mine) this.child = null;
      if (mine && started && !this.stopping && !quitting) this.onCrash?.(code);
    });
    onStatus(t.desktop.splash.seeding);
    const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (exited !== null) throw new Error(`a szerver kilépett (${exited}) – napló: ${path.join(LOG_DIR, "server.log")}`);
      if (await health(this.url)) {
        log("a szerver válaszol");
        started = true;
        return this.url;
      }
      await sleep(300);
    }
    this.stop();
    throw new Error(`a szerver nem válaszolt ${SERVER_START_TIMEOUT_MS / 1000} s alatt – napló: ${path.join(LOG_DIR, "server.log")}`);
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    this.stopping = true;
    if (!child || child.exitCode !== null) return;
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }

  async restart(onStatus: (s: string) => void): Promise<string> {
    this.stop();
    await sleep(300);
    return this.start(onStatus);
  }
}

const server = new LocalServer();

/* ------------------------------------------------------------ updater */

type Listener = (s: UpdateState) => void;

class Updater {
  state: UpdateState = { kind: "idle" };
  private listeners = new Set<Listener>();
  private dismissed: string | null = null;
  private silent = true;
  private configured = false;

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private set(s: UpdateState): void {
    this.state = s;
    for (const l of this.listeners) l(s);
  }

  /** The pushed state: an "available" the user put off carries dismissed=true (banner hidden, top-bar dot kept). */
  visible(): UpdateState {
    if (this.state.kind === "available") return { ...this.state, dismissed: this.state.version === this.dismissed };
    return this.state;
  }

  dismiss(): void {
    if (this.state.kind === "available") this.dismissed = this.state.version;
    else if (this.state.kind === "error") this.state = { kind: "idle" };
    this.set(this.state);
  }

  private installable(): boolean {
    if (process.platform === "darwin") return false; // unsigned build: the user replaces the app
    if (process.platform === "linux") return !!process.env.APPIMAGE;
    return true;
  }

  configure(): void {
    if (this.configured) return;
    this.configured = true;
    if (!app.isPackaged) {
      this.set({ kind: "disabled", reason: "dev" });
      return;
    }
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.logger = {
      info: (m: unknown) => log(`[updater] ${String(m)}`),
      warn: (m: unknown) => log(`[updater] ⚠ ${String(m)}`),
      error: (m: unknown) => log(`[updater] ✖ ${String(m)}`),
      debug: () => {},
    };
    this.applyToken();
    autoUpdater.on("checking-for-update", () => {
      // a silent re-check keeps a known update on screen; only a manual check shows "checking"
      if (this.silent && this.state.kind === "available") return;
      this.set({ kind: "checking" });
    });
    autoUpdater.on("update-available", (info: UpdateInfo) => {
      const notes = Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => (typeof n === "string" ? n : n.note ?? "")).join("\n\n")
        : (info.releaseNotes ?? "");
      const size = info.files?.reduce((n, f) => n + (f.size ?? 0), 0) || null;
      this.set({ kind: "available", version: info.version, notes: notes.trim(), size, installable: this.installable(), url: RELEASES_URL, dismissed: false });
    });
    autoUpdater.on("update-not-available", () => this.set({ kind: "up-to-date", version: app.getVersion() }));
    autoUpdater.on("download-progress", (p) =>
      this.set({
        kind: "downloading",
        version: this.state.kind === "downloading" || this.state.kind === "available" ? this.state.version : "",
        percent: Math.round(p.percent),
        transferred: p.transferred,
        total: p.total,
      }),
    );
    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.set({ kind: "downloaded", version: info.version });
      // Like the reference app: downloaded → installed → restarted, without another click.
      setTimeout(() => this.install(), 800);
    });
    autoUpdater.on("error", (e: Error) => {
      log(`[updater] hiba: ${e.stack ?? e.message}`);
      this.failed(e);
    });
  }

  /** A private repository needs a read-only token; the GitHub provider is re-pointed at the API with it. */
  applyToken(): void {
    const token = readToken();
    if (token) autoUpdater.setFeedURL({ provider: "github", owner: GITHUB.owner, repo: GITHUB.repo, private: true, token });
    else autoUpdater.setFeedURL({ provider: "github", owner: GITHUB.owner, repo: GITHUB.repo });
  }

  /** The state a check started from (electron-updater emits "checking-for-update" before any error). */
  private before: UpdateState = { kind: "idle" };

  /** A silent (background) failure never hides a known update or nags; a manual one shows the error. */
  private failed(e: Error): void {
    if (this.silent) {
      this.set(this.before.kind === "available" ? this.before : { kind: "idle" });
      return;
    }
    this.set({ kind: "error", message: e.message, url: RELEASES_URL });
  }

  private checking: Promise<UpdateState> | null = null;

  async check(silent: boolean): Promise<UpdateState> {
    this.configure();
    if (!app.isPackaged) return this.state;
    if (this.state.kind === "downloading" || this.state.kind === "downloaded") return this.state;
    // one check at a time – a manual check joins the running one but still wants to see its outcome
    if (this.checking) {
      if (!silent) this.silent = false;
      return this.checking;
    }
    this.silent = silent;
    this.before = this.state;
    if (!silent) this.dismissed = null;
    this.checking = (async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        // no update feed on this platform (e.g. Linux outside an AppImage): no events were emitted
        if (!result) this.set({ kind: "disabled", reason: "unsupported" });
        else if (this.state.kind === "checking") this.set({ kind: "up-to-date", version: app.getVersion() });
      } catch (e) {
        const err = e as Error;
        log(`[updater] az ellenőrzés nem sikerült: ${err.message}`);
        this.failed(err);
      } finally {
        this.checking = null;
      }
      return this.visible();
    })();
    return this.checking;
  }

  async download(): Promise<UpdateState> {
    if (this.state.kind !== "available") return this.visible();
    if (!this.state.installable) {
      await shell.openExternal(this.state.url);
      return this.visible();
    }
    this.silent = false;
    const version = this.state.version;
    this.set({ kind: "downloading", version, percent: 0, transferred: 0, total: this.state.size ?? 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      const err = e as Error;
      log(`[updater] a letöltés nem sikerült: ${err.message}`);
      this.set({ kind: "error", message: err.message, url: RELEASES_URL });
    }
    return this.visible();
  }

  install(): void {
    if (this.state.kind !== "downloaded") return;
    log("[updater] telepítés és újraindítás");
    // the server is stopped in before-quit; the new instance (AppImage) may start before this one is gone
    app.releaseSingleInstanceLock();
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  }
}

const updater = new Updater();

/* --------------------------------------------------------------- token */

function readToken(): string | null {
  const s = readSettings();
  if (!s.updateToken) return null;
  if (s.updateTokenPlain) return s.updateToken;
  try {
    return safeStorage.decryptString(Buffer.from(s.updateToken, "base64")) || null;
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) {
    writeSettings({ updateToken: undefined, updateTokenPlain: undefined });
    return;
  }
  if (safeStorage.isEncryptionAvailable()) {
    writeSettings({ updateToken: safeStorage.encryptString(trimmed).toString("base64"), updateTokenPlain: undefined });
  } else {
    writeSettings({ updateToken: trimmed, updateTokenPlain: true });
  }
}

/* -------------------------------------------------------------- window */

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;
let quitting = false;

function info(): DesktopInfo {
  return {
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    url: server.url,
    paths: { data: dataDir(), exchange: exchangeDir(), logs: LOG_DIR },
    hasUpdateToken: !!readToken(),
    releasesUrl: RELEASES_URL,
  };
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);
/** Same origin as the local server (a prefix test would accept http://127.0.0.1:1234@evil.com/). */
const isOurs = (u: string) => {
  if (!server.url) return false;
  try {
    return new URL(u).origin === new URL(server.url).origin;
  } catch {
    return false;
  }
};

function splashHtml(status: string): string {
  const dark = nativeTheme.shouldUseDarkColors;
  const bg = dark ? "#15181c" : "#f6f5f1";
  const fg = dark ? "#e8e6df" : "#1d1a14";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(t.appName)}</title>
<style>html,body{margin:0;height:100%;background:${bg};color:${fg};font:15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.w{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px}
h1{font-size:20px;font-weight:600;margin:0}.s{opacity:.75}
.r{width:28px;height:28px;border:3px solid rgba(47,111,106,.25);border-top-color:#2f6f6a;border-radius:50%;animation:a 1s linear infinite}
@keyframes a{to{transform:rotate(360deg)}}</style></head>
<body><div class="w"><div class="r"></div><h1>${esc(t.appName)}</h1><div class="s" id="s">${esc(status)}</div></div></body></html>`;
}

function showSplash(): void {
  splash = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: false,
    frame: false,
    show: false,
    title: t.appName,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#15181c" : "#f6f5f1",
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(t.desktop.splash.starting))}`);
  splash.once("ready-to-show", () => splash?.show());
}
function splashStatus(s: string): void {
  splash?.webContents.executeJavaScript(`document.getElementById("s").textContent=${JSON.stringify(s)}`).catch(() => {});
}
function closeSplash(): void {
  splash?.close();
  splash = null;
}

/** Saved bounds are used only when they still fall on a connected display (undocked monitor, changed scaling). */
function savedBounds(): { x?: number; y?: number; width: number; height: number; maximized?: boolean } | undefined {
  const b = readSettings().windowBounds;
  if (!b) return undefined;
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x + 100 < a.x + a.width && b.x + b.width - 100 > a.x && b.y + 40 < a.y + a.height && b.y >= a.y - 20;
  });
  return onScreen ? b : { width: b.width, height: b.height, maximized: b.maximized };
}

function createWindow(url: string): BrowserWindow {
  const bounds = savedBounds();
  const w = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 860,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: t.appName,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#15181c" : "#f6f5f1",
    icon: process.platform === "linux" ? path.join(RESOURCES, "icon.png") : undefined,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  w.once("ready-to-show", () => {
    closeSplash();
    if (bounds?.maximized) w.maximize();
    w.show();
  });
  w.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isHttp(target) && !isOurs(target)) void shell.openExternal(target);
    else if (isOurs(target)) void w.loadURL(target);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, target) => {
    if (isOurs(target)) return;
    e.preventDefault();
    if (isHttp(target)) void shell.openExternal(target);
  });
  w.on("close", () => {
    // a maximized window remembers its normal bounds plus the maximized flag
    if (!w.isMinimized() && !w.isFullScreen()) writeSettings({ windowBounds: { ...w.getNormalBounds(), maximized: w.isMaximized() } });
  });
  w.on("closed", () => {
    if (win === w) win = null;
  });
  void w.loadURL(url);
  return w;
}

function sendState(): void {
  const s = updater.visible();
  for (const bw of BrowserWindow.getAllWindows()) {
    if (bw !== splash) bw.webContents.send(IPC.updateEvent, s);
  }
}

/* ---------------------------------------------------------------- menu */

async function manualCheck(): Promise<void> {
  const s = await updater.check(false);
  if (!win) return;
  if (s.kind === "up-to-date") {
    await dialog.showMessageBox(win, { type: "info", title: t.desktop.dialog.upToDateTitle, message: t.desktop.upToDate(s.version), buttons: ["OK"] });
  } else if (s.kind === "error") {
    const r = await dialog.showMessageBox(win, {
      type: "error",
      title: t.desktop.dialog.errorTitle,
      message: t.desktop.error(s.message),
      buttons: [t.desktop.errorManual, "OK"],
      defaultId: 1,
    });
    if (r.response === 0) void shell.openExternal(s.url);
  } else if (s.kind === "disabled") {
    await dialog.showMessageBox(win, { type: "info", title: t.desktop.title, message: s.reason === "dev" ? t.desktop.devMode : t.desktop.unsupported, buttons: ["OK"] });
  }
  // "available" is shown by the banner in the page
}

function openPath(kind: DesktopPathKind): Promise<string> {
  const dir = info().paths[kind];
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
}

function buildMenu(): void {
  const m = t.desktop.menu;
  const appMenu: MenuItemConstructorOptions = {
    label: m.app,
    submenu: [
      { label: m.checkUpdates, click: () => void manualCheck() },
      { type: "separator" },
      { label: m.openData, click: () => void openPath("data") },
      { label: m.openExchange, click: () => void openPath("exchange") },
      { label: m.openLogs, click: () => void openPath("logs") },
      { type: "separator" },
      { label: m.openInBrowser, click: () => void shell.openExternal(server.url) },
      { type: "separator" },
      { role: "quit", label: m.quit },
    ],
  };
  const view: MenuItemConstructorOptions = {
    label: m.view,
    submenu: [
      { role: "reload", label: m.reload },
      { type: "separator" },
      { role: "zoomIn", label: m.zoomIn },
      { role: "zoomOut", label: m.zoomOut },
      { role: "resetZoom", label: m.zoomReset },
      { type: "separator" },
      { role: "togglefullscreen", label: m.fullscreen },
      ...(app.isPackaged ? [] : [{ role: "toggleDevTools", label: m.devtools } as MenuItemConstructorOptions]),
    ],
  };
  const help: MenuItemConstructorOptions = {
    label: m.help,
    submenu: [
      { label: m.installGuide, click: () => void shell.openExternal(INSTALL_GUIDE_URL) },
      { label: m.releases, click: () => void shell.openExternal(RELEASES_URL) },
      { label: m.reportIssue, click: () => void shell.openExternal(ISSUES_URL) },
      { type: "separator" },
      {
        label: m.about,
        click: () => void dialog.showMessageBox({ type: "info", title: m.about, message: t.appName, detail: m.aboutText(app.getVersion(), server.url), buttons: ["OK"] }),
      },
    ],
  };
  const template: MenuItemConstructorOptions[] = process.platform === "darwin" ? [{ role: "appMenu" }, appMenu, { role: "editMenu" }, view, help] : [appMenu, view, help];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ----------------------------------------------------------------- IPC */

function registerIpc(): void {
  ipcMain.handle(IPC.info, () => info());
  ipcMain.handle(IPC.updateState, () => updater.visible());
  ipcMain.handle(IPC.updateCheck, () => updater.check(false));
  ipcMain.handle(IPC.updateDownload, () => updater.download());
  ipcMain.handle(IPC.updateInstall, () => updater.install());
  ipcMain.handle(IPC.updateDismiss, () => updater.dismiss());
  ipcMain.handle(IPC.updateSetToken, (_e, token: unknown) => {
    if (typeof token !== "string") throw new Error("token must be a string");
    saveToken(token);
    updater.applyToken();
    return info();
  });
  ipcMain.handle(IPC.openPath, async (_e, kind: unknown) => {
    if (!DESKTOP_PATH_KINDS.includes(kind as DesktopPathKind)) throw new Error("unknown path kind");
    await openPath(kind as DesktopPathKind);
  });
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown) => {
    if (typeof url !== "string" || !isHttp(url)) throw new Error("only http(s) links can be opened");
    await shell.openExternal(url);
  });
  ipcMain.handle(IPC.openInBrowser, () => shell.openExternal(server.url));
  ipcMain.handle(IPC.chooseExchangeDir, async () => {
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: t.desktop.dialog.exchangeTitle,
      buttonLabel: t.desktop.dialog.exchangeButton,
      defaultPath: exchangeDir(),
      properties: ["openDirectory", "createDirectory"],
    });
    const chosen = r.filePaths[0];
    if (r.canceled || !chosen) return null;
    const previous = readSettings().exchangeDir;
    writeSettings({ exchangeDir: chosen });
    exchangeFallback = null;
    log(`új beadás-mappa: ${chosen}`);
    if (!DEV_URL) {
      const current = win.webContents.getURL();
      const pathname = isOurs(current) ? new URL(current).pathname : "/beallitasok";
      try {
        const url = await server.restart(() => {});
        // answer first so the page can show its confirmation, then reload it from the restarted server
        setTimeout(() => void win?.loadURL(`${url}${pathname}`), 600);
      } catch (e) {
        log(`a szerver nem indult újra az új mappával: ${(e as Error).message}`);
        writeSettings({ exchangeDir: previous });
        const url = await server.restart(() => {});
        setTimeout(() => void win?.loadURL(`${url}${pathname}`), 600);
        throw e;
      }
    }
    return info();
  });
}

/* --------------------------------------------------------------- start */

async function smokeTest(url: string): Promise<void> {
  const w = win!;
  await new Promise<void>((resolve) => {
    if (!w.webContents.isLoading()) resolve();
    else w.webContents.once("did-finish-load", () => resolve());
  });
  await sleep(1500);
  const title = (await w.webContents.executeJavaScript("document.title")) as string;
  const subjects = (await w.webContents.executeJavaScript('document.querySelectorAll("[data-testid^=subject-]").length')) as number;
  if (SMOKE_SHOT && SMOKE_SHOT !== "true") {
    const img = await w.webContents.capturePage();
    fs.writeFileSync(SMOKE_SHOT, img.toPNG());
  }
  // The home page must really render (a server error page has no title and no subject cards).
  if (!title || subjects < 1) throw new Error(`a kezdőképernyő nem töltött be (cím: "${title}", tantárgyak: ${subjects}) – napló: ${path.join(LOG_DIR, "server.log")}`);
  console.log(JSON.stringify({ ok: true, url, version: app.getVersion(), title, subjects, dataDir: dataDir(), exchangeDir: exchangeDir() }));
}

let starting = false;

/** "Az app nem tudott elindulni" – retry or quit; the splash stays so the app has a window meanwhile. */
async function startFailed(err: Error): Promise<boolean> {
  log(`indítási hiba: ${err.stack ?? err.message}`);
  if (SMOKE) {
    console.log(JSON.stringify({ ok: false, error: err.message }));
    app.exit(1);
    return false;
  }
  if (!splash) showSplash();
  const r = await dialog.showMessageBox(splash!, {
    type: "error",
    title: t.appName,
    message: t.desktop.splash.failed,
    detail: `${err.message}\n\n${t.desktop.splash.failedHint(path.join(LOG_DIR, "server.log"))}`,
    buttons: [t.desktop.splash.retry, t.desktop.splash.quit],
    defaultId: 0,
  });
  return r.response === 0;
}

/** The server died while the window was open: offer a restart, keep the window. */
function serverCrashed(code: number | null): void {
  if (quitting || !win) return;
  log(`a szerver váratlanul leállt (${code}) – újraindítás felajánlva`);
  void (async () => {
    const r = await dialog.showMessageBox(win!, {
      type: "error",
      title: t.appName,
      message: t.desktop.splash.failed,
      detail: t.desktop.splash.failedHint(path.join(LOG_DIR, "server.log")),
      buttons: [t.desktop.splash.retry, t.desktop.splash.quit],
      defaultId: 0,
    });
    if (r.response !== 0 || !win) {
      app.quit();
      return;
    }
    try {
      const url = await server.start(() => {});
      await win.loadURL(url);
    } catch (e) {
      serverCrashed(-1);
      log((e as Error).message);
    }
  })();
}

/** Seeding problems reported by /api/health after start-up (the window is open; the bank may be stale). */
function warnIfSeedFailed(url: string): void {
  http
    .get(`${url}/api/health`, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString("utf8")));
      res.on("end", () => {
        try {
          const j = JSON.parse(body) as { seed?: { ok: boolean; error?: string } };
          if (j.seed && !j.seed.ok) {
            log(`a tartalom betöltése nem sikerült: ${j.seed.error}`);
            if (win && !SMOKE) void dialog.showMessageBox(win, { type: "warning", title: t.appName, message: t.desktop.splash.seedFailed, detail: `${j.seed.error ?? ""}\n\n${path.join(LOG_DIR, "server.log")}`, buttons: ["OK"] });
          }
        } catch {
          /* not json */
        }
      });
    })
    .on("error", () => {});
}

async function start(): Promise<void> {
  starting = true;
  showSplash();
  let url: string;
  for (;;) {
    try {
      url = await server.start(splashStatus);
      break;
    } catch (e) {
      if (await startFailed(e as Error)) continue;
      quitting = true;
      app.quit();
      return;
    }
  }
  server.onCrash = serverCrashed;
  win = createWindow(url);
  starting = false;
  buildMenu();
  warnIfSeedFailed(url);
  updater.configure();
  if (SMOKE) {
    const timer = setTimeout(() => {
      console.log(JSON.stringify({ ok: false, error: "smoke test timeout" }));
      app.exit(1);
    }, 60_000);
    try {
      await smokeTest(url);
      clearTimeout(timer);
      quitting = true;
      server.stop();
      app.exit(0);
    } catch (e) {
      console.log(JSON.stringify({ ok: false, error: (e as Error).message }));
      app.exit(1);
    }
    return;
  }
  updater.onChange(sendState);
  setTimeout(() => void updater.check(true), 4000);
  setInterval(() => void updater.check(true), UPDATE_CHECK_INTERVAL_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    registerIpc();
    void start();
  });
  app.on("window-all-closed", () => {
    if (!starting) app.quit();
  });
  app.on("before-quit", () => {
    quitting = true;
    server.stop();
  });
  process.on("uncaughtException", (e) => {
    log(`váratlan hiba: ${e.stack ?? e.message}`);
    if (!quitting && !SMOKE) dialog.showErrorBox(t.appName, e.message);
  });
}

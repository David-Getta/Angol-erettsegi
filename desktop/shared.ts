/**
 * Contract between the Electron main process (desktop/main.ts), the preload
 * bridge (desktop/preload.ts) and the Next.js UI (components/desktop/*).
 * The UI only ever sees `window.desktop`; in a plain browser it is undefined.
 */

/** Where the self-update stands. The main process owns it and pushes every change to the window. */
export type UpdateState =
  | { kind: "idle" }
  /** dev = unpackaged run (electron . --dev-url), unsupported = no update feed for this platform */
  | { kind: "disabled"; reason: "dev" | "unsupported" }
  | { kind: "checking" }
  | { kind: "up-to-date"; version: string }
  | {
      kind: "available";
      version: string;
      /** Release notes (markdown from the GitHub release body; may be empty). */
      notes: string;
      /** Download size in bytes when known. */
      size: number | null;
      /** false = the app cannot replace itself here (unsigned macOS build): the user downloads the file. */
      installable: boolean;
      /** Page or file to open when the update is not installable. */
      url: string;
      /** true after "Később": the banner stays hidden, the top-bar dot remains. */
      dismissed: boolean;
    }
  | { kind: "downloading"; version: string; percent: number; transferred: number; total: number }
  | { kind: "downloaded"; version: string }
  | { kind: "error"; message: string; url: string };

export type DesktopPathKind = "data" | "exchange" | "logs";

export type DesktopInfo = {
  version: string;
  platform: string;
  isPackaged: boolean;
  /** The local server the window shows (http://127.0.0.1:<port>) – the same app opens in a browser. */
  url: string;
  paths: Record<DesktopPathKind, string>;
  hasUpdateToken: boolean;
  releasesUrl: string;
};

export interface DesktopApi {
  info(): Promise<DesktopInfo>;
  update: {
    state(): Promise<UpdateState>;
    /** Manual check; resolves with the resulting state (also pushed through onState). */
    check(): Promise<UpdateState>;
    download(): Promise<UpdateState>;
    /** Quits and installs the downloaded update; the app restarts by itself. */
    install(): Promise<void>;
    /** Hides the banner for this version until the next start. */
    dismiss(): Promise<void>;
    onState(listener: (state: UpdateState) => void): () => void;
    /** GitHub token for a private repository; an empty string removes it. */
    setToken(token: string): Promise<DesktopInfo>;
  };
  openPath(kind: DesktopPathKind): Promise<void>;
  /** http(s) links only. */
  openExternal(url: string): Promise<void>;
  /** Opens the running app in the system browser (speech recognition works there). */
  openInBrowser(): Promise<void>;
  /** Folder picker for the exchange folder; the server restarts with it. null = cancelled. */
  chooseExchangeDir(): Promise<DesktopInfo | null>;
}

/** IPC channel names shared by main and preload. */
export const IPC = {
  info: "desktop:info",
  updateState: "desktop:update:state",
  updateCheck: "desktop:update:check",
  updateDownload: "desktop:update:download",
  updateInstall: "desktop:update:install",
  updateDismiss: "desktop:update:dismiss",
  updateSetToken: "desktop:update:set-token",
  /** main → renderer push of UpdateState */
  updateEvent: "desktop:update:event",
  openPath: "desktop:open-path",
  openExternal: "desktop:open-external",
  openInBrowser: "desktop:open-in-browser",
  chooseExchangeDir: "desktop:choose-exchange-dir",
} as const;

export const DESKTOP_PATH_KINDS: readonly DesktopPathKind[] = ["data", "exchange", "logs"];

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

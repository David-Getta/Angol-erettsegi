"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import { Card, btn } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { DesktopPathKind, UpdateState } from "@/desktop/shared";
import { useDesktopInfo, useUpdateState } from "./bridge";

function updateLine(s: UpdateState | null, version: string): string {
  if (!s) return "";
  switch (s.kind) {
    case "checking":
      return t.desktop.checking;
    case "up-to-date":
      return t.desktop.upToDate(s.version);
    case "available":
      return t.desktop.available(s.version);
    case "downloading":
      return t.desktop.downloading(s.percent);
    case "downloaded":
      return t.desktop.installing;
    case "error":
      return t.desktop.error(s.message);
    case "disabled":
      return s.reason === "dev" ? t.desktop.devMode : t.desktop.unsupported;
    default:
      return t.desktop.version(version);
  }
}

/** "Asztali alkalmazás" card on the settings page – only in the Electron app. */
export function DesktopSettings() {
  const { api, info, refresh } = useDesktopInfo();
  const state = useUpdateState();
  const toast = useToast();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  if (!api || !info) return null;

  const folders: { kind: DesktopPathKind; label: string }[] = [
    { kind: "data", label: t.desktop.dataFolder },
    { kind: "exchange", label: t.desktop.exchangeFolder },
    { kind: "logs", label: t.desktop.logsFolder },
  ];

  const check = async () => {
    setBusy(true);
    try {
      const s = await api.update.check();
      if (s.kind === "up-to-date") toast(t.desktop.upToDate(s.version));
      else if (s.kind === "error") toast(t.desktop.error(s.message));
      else if (s.kind === "disabled") toast(s.reason === "dev" ? t.desktop.devMode : t.desktop.unsupported);
    } finally {
      setBusy(false);
    }
  };

  const saveToken = async () => {
    const trimmed = token.trim();
    await api.update.setToken(trimmed);
    setToken("");
    refresh();
    toast(trimmed ? t.desktop.tokenSaved : t.desktop.tokenCleared);
    if (trimmed) await check();
  };

  const chooseExchange = async () => {
    const r = await api.chooseExchangeDir();
    if (r) {
      refresh();
      toast(t.desktop.exchangeChanged);
    }
  };

  const field = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2";
  return (
    <div data-testid="desktop-settings">
    <Card title={t.desktop.title}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="text-sm font-medium">{t.desktop.version(info.version)}</div>
          <p className="mt-1 text-xs text-muted">{t.desktop.autoUpdateHint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} disabled={busy} onClick={() => void check()} data-testid="desktop-check-updates">
              ⭳ {t.desktop.checkUpdates}
            </button>
            <span className="text-xs text-muted" data-testid="desktop-update-line">
              {updateLine(state, info.version)}
            </span>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium" htmlFor="desktop-token">
              {t.desktop.token}
            </label>
            <p className="mt-1 text-xs text-muted">{t.desktop.tokenHint}</p>
            <input
              id="desktop-token"
              type="password"
              autoComplete="off"
              className={field}
              placeholder={info.hasUpdateToken ? t.desktop.tokenSet : t.desktop.tokenPlaceholder}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button type="button" className={`${btn.small} mt-2`} onClick={() => void saveToken()}>
              {t.desktop.save}
            </button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">{t.desktop.folders}</div>
          <ul className="mt-2 space-y-2 text-sm">
            {folders.map((f) => (
              <li key={f.kind} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{f.label}</span>
                  <code className="block break-all font-mono text-xs">{info.paths[f.kind]}</code>
                </span>
                <span className="flex gap-1">
                  <button type="button" className={btn.small} onClick={() => void api.openPath(f.kind)}>
                    {t.desktop.open}
                  </button>
                  {f.kind === "exchange" && (
                    <button type="button" className={btn.small} onClick={() => void chooseExchange()}>
                      {t.desktop.changeExchange}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t.desktop.exchangeHint}</p>
          <div className="mt-4">
            <button type="button" className={btn.secondary} onClick={() => void api.openInBrowser()} data-testid="desktop-open-browser">
              ↗ {t.desktop.openInBrowser}
            </button>
            <p className="mt-1 text-xs text-muted">
              {t.desktop.openInBrowserHint} <code className="font-mono">{info.url}</code>
            </p>
          </div>
        </div>
      </div>
    </Card>
    </div>
  );
}

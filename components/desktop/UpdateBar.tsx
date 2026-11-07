"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import { btn } from "@/components/ui";
import { megabytes, useDesktop, useUpdateState } from "./bridge";

/** Markdown from the GitHub release body shown as plain, readable text. */
export function plainMarkdown(md: string): string {
  return md
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Gold banner at the top of the page in the desktop app: a new release is
 * available → "Frissítés most" downloads, installs and restarts the app
 * (on an unsigned macOS build it opens the download page instead).
 * Renders nothing in a browser or when there is nothing to say.
 */
export function UpdateBar() {
  const api = useDesktop();
  const state = useUpdateState();
  const [notesOpen, setNotesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!api || !state) return null;

  const box = "mb-5 rounded-xl border px-4 py-3 text-sm";
  if (state.kind === "downloading") {
    return (
      <div className={`${box} border-warn bg-warn-soft`} data-testid="update-bar" role="status">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-warn">
            ⭳ {t.desktop.available(state.version)} · {t.desktop.downloading(state.percent)}
          </span>
          <span className="text-xs text-muted">{t.desktop.downloadingHint}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-surface">
          <div className="h-2 bg-warn transition-[width]" style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }} />
        </div>
      </div>
    );
  }
  if (state.kind === "downloaded") {
    return (
      <div className={`${box} flex items-center justify-between gap-3 border-warn bg-warn-soft`} data-testid="update-bar" role="status">
        <span className="font-medium text-warn">
          ⭳ {t.desktop.downloaded(state.version)} · {t.desktop.installing}
        </span>
        <button type="button" className={btn.small} onClick={() => void api.update.install()}>
          {t.desktop.installNow}
        </button>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className={`${box} flex flex-wrap items-center justify-between gap-3 border-bad/40 bg-bad-soft text-bad`} data-testid="update-bar" role="alert">
        <span>{t.desktop.error(state.message)}</span>
        <span className="flex gap-2">
          <button type="button" className={btn.small} onClick={() => void api.update.check()}>
            {t.desktop.retry}
          </button>
          <button type="button" className={btn.small} onClick={() => void api.openExternal(state.url)}>
            {t.desktop.errorManual}
          </button>
        </span>
      </div>
    );
  }
  if (state.kind !== "available") return null;
  const mb = megabytes(state.size);
  const act = async () => {
    setBusy(true);
    try {
      await api.update.download();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`${box} border-warn bg-warn-soft`} data-testid="update-bar" role="status">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-warn">⭳ {t.desktop.available(state.version)}</div>
          <div className="text-xs text-muted">{state.installable ? t.desktop.availableHint(mb) : t.desktop.availableManualHint}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.notes && (
            <button type="button" className={btn.ghost} onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen}>
              {t.desktop.whatsNew}
            </button>
          )}
          <button type="button" className={btn.ghost} onClick={() => void api.update.dismiss()}>
            {t.desktop.later}
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void act()} data-testid="update-now">
            {state.installable ? t.desktop.updateNow : t.desktop.download}
          </button>
        </div>
      </div>
      {notesOpen && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t.desktop.whatsNewTitle(state.version)}</div>
          <pre className="whitespace-pre-wrap font-sans text-sm">{plainMarkdown(state.notes) || t.desktop.noNotes}</pre>
        </div>
      )}
    </div>
  );
}

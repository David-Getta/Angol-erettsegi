"use client";

import { t } from "@/lib/i18n/hu";
import { useToast } from "@/components/Toast";
import { useDesktop, useUpdateState } from "./bridge";

/** ⭳ icon in the top bar of the desktop app: manual update check; a gold dot marks a waiting update. */
export function TopbarUpdateButton() {
  const api = useDesktop();
  const state = useUpdateState();
  const toast = useToast();
  if (!api) return null;
  const waiting = state?.kind === "available";
  const check = async () => {
    const s = await api.update.check();
    if (s.kind === "up-to-date") toast(t.desktop.upToDate(s.version));
    else if (s.kind === "error") toast(t.desktop.error(s.message));
    else if (s.kind === "disabled") toast(s.reason === "dev" ? t.desktop.devMode : t.desktop.unsupported);
  };
  return (
    <button
      type="button"
      onClick={() => void check()}
      title={waiting && state.kind === "available" ? t.desktop.available(state.version) : t.desktop.checkUpdates}
      aria-label={t.desktop.checkUpdates}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-base hover:bg-surface-2"
      data-testid="topbar-update"
    >
      ⭳
      {waiting && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warn" aria-hidden />}
    </button>
  );
}

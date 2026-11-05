"use client";

import { useEffect, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n/hu";
import { CopyButton } from "./CopyButton";

/**
 * Situational tip: shows the exact Claude Code command to run next with a copy
 * button. The server decides whether the situation exists; the user can hide
 * a tip (remembered per `dismissKey` in localStorage).
 */
export function CommandTip({
  command,
  message,
  dismissKey,
  children,
  testId = "command-tip",
}: {
  command: string;
  message: ReactNode;
  dismissKey?: string;
  children?: ReactNode;
  testId?: string;
}) {
  const storageKey = dismissKey ? `tip-dismissed:${dismissKey}` : null;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  if (hidden) return null;
  return (
    <div data-testid={testId} className="my-3 rounded-lg border border-accent/30 bg-accent-soft/60 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden>💡</span>
        <span className="flex-1">{message}</span>
        {storageKey && (
          <button
            type="button"
            className="text-xs text-muted hover:text-fg"
            onClick={() => {
              try {
                localStorage.setItem(storageKey, "1");
              } catch {
                /* ignore */
              }
              setHidden(true);
            }}
            aria-label={t.common.dismiss}
          >
            ✕
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-surface px-2 py-1 font-mono text-[13px]" data-testid="command-tip-command">
          {command}
        </code>
        <CopyButton text={command} testId="command-tip-copy" />
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import type { Level } from "@/lib/content/schema";
import { setLevelAction } from "@/app/actions";

const ALL: Level[] = ["kozep", "emelt"];

export function LevelSwitch({ level, levels = ALL }: { level: Level; levels?: Level[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (levels.length === 1) {
    // the subject is studied at one level only: no switch, just the level
    return (
      <div className="flex items-center gap-2 text-sm" title={t.level.fixedHint}>
        <span className="hidden text-muted sm:inline">{t.level.switchLabel}:</span>
        <span className="rounded-md border border-border bg-accent px-3 py-1 text-accent-fg" data-testid="level-fixed">
          {t.level.short[level]}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm" aria-busy={pending} title={t.level.switchHint}>
      <span className="hidden text-muted sm:inline">{t.level.switchLabel}:</span>
      <div className="inline-flex overflow-hidden rounded-md border border-border" role="group">
        {ALL.map((l) => (
          <button
            key={l}
            type="button"
            data-testid={`level-${l}`}
            aria-pressed={level === l}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setLevelAction(l);
                router.refresh();
              })
            }
            className={`px-2 py-1 sm:px-3 ${level === l ? "bg-accent text-accent-fg" : "bg-surface hover:bg-surface-2"}`}
          >
            {t.level.short[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

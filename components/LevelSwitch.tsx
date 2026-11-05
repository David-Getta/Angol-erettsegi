"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import type { Level } from "@/lib/content/schema";
import { setLevelAction } from "@/app/actions";

export function LevelSwitch({ level }: { level: Level }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 text-sm" aria-busy={pending}>
      <span className="hidden text-muted sm:inline">{t.level.switchLabel}:</span>
      <div className="inline-flex overflow-hidden rounded-md border border-border" role="group">
        {(["kozep", "emelt"] as const).map((l) => (
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
            className={`px-3 py-1 ${level === l ? "bg-accent text-accent-fg" : "bg-surface hover:bg-surface-2"}`}
          >
            {t.level.short[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { addWordCardAction } from "@/app/actions-practice";
import { t } from "@/lib/i18n/hu";

/** "Kártyára:" chips for the phrases quoted in the notes of a model / sample answer. */
export function AddPhraseChips({ phrases, taskId, sourceType }: { phrases: string[]; taskId: string; sourceType: string }) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  if (phrases.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" data-testid="phrase-chips">
      <span className="text-muted">{t.phrases.toCards}</span>
      {phrases.map((p) =>
        added.has(p) ? (
          <span key={p} className="rounded-full border border-good/30 bg-good-soft px-2 py-0.5 text-good">
            ✓ {p}
          </span>
        ) : (
          <button
            key={p}
            type="button"
            disabled={pending}
            className="rounded-full border border-border bg-surface px-2 py-0.5 hover:border-accent hover:text-accent disabled:opacity-50"
            onClick={() =>
              start(async () => {
                await addWordCardAction({ term: p, sourceType, taskId });
                setAdded((s) => new Set(s).add(p));
              })
            }
          >
            ＋ {p}
          </button>
        ),
      )}
    </div>
  );
}

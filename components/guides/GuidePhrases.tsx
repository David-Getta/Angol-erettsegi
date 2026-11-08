"use client";

import { useState, useTransition } from "react";
import { addWordCardAction } from "@/app/actions-practice";
import { t } from "@/lib/i18n/hu";
import { useContentLang } from "@/components/ContentLang";

/** Phrase groups of a guide, each phrase one click away from the flashcards. */
export function GuidePhrases({ phrases, guideId }: { phrases: { group: string; en: string; hu: string }[]; guideId: string }) {
  const contentLang = useContentLang();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const groups = [...new Set(phrases.map((p) => p.group))];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-1 text-sm font-semibold">{g}</h3>
          <ul className="divide-y divide-border text-sm">
            {phrases
              .filter((p) => p.group === g)
              .map((p) => (
                <li key={p.en} className="flex items-baseline gap-3 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span lang={contentLang} className="font-reading text-[15px]">
                      {p.en}
                    </span>
                    <span className="block text-muted">{p.hu}</span>
                  </span>
                  {added.has(p.en) ? (
                    <span className="shrink-0 text-xs text-good">{t.phrases.added}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className="shrink-0 text-xs text-accent hover:underline disabled:opacity-50"
                      onClick={() =>
                        start(async () => {
                          await addWordCardAction({ term: p.en, meaning: p.hu, sourceType: "guide", taskId: guideId });
                          setAdded((s) => new Set(s).add(p.en));
                        })
                      }
                    >
                      {t.phrases.add}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

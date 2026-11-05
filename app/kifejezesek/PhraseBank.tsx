"use client";

import { useMemo, useState, useTransition } from "react";
import type { PhraseGroup } from "@/lib/phrases";
import { addWordCardAction } from "@/app/actions-practice";
import { Card } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function PhraseBank({ groups }: { groups: (PhraseGroup & { label: string })[] }) {
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return groups;
    return groups
      .map((g) => ({ ...g, phrases: g.phrases.filter((p) => norm(p.en).includes(n) || norm(p.hu).includes(n)) }))
      .filter((g) => g.phrases.length > 0);
  }, [groups, q]);

  return (
    <div className="space-y-5">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.phrases.search}
        className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm"
        data-testid="phrase-search"
      />
      {filtered.length === 0 && <p className="text-sm text-muted">{t.phrases.none}</p>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filtered.map((g) => (
          <Card key={`${g.section}-${g.type}`} title={`${g.label} · ${t.phrases.count(g.phrases.length)}`}>
            <ul className="divide-y divide-border text-sm" data-testid={`phrases-${g.section}-${g.type}`}>
              {g.phrases.map((p) => {
                const isAdded = p.inCards || added.has(p.en);
                return (
                  <li key={p.en} className="flex items-baseline gap-3 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span lang="en" className="font-reading text-[15px]">{p.en}</span>
                      <span className="block text-muted">{p.hu}</span>
                    </span>
                    {isAdded ? (
                      <span className="shrink-0 text-xs text-good">{p.inCards ? t.phrases.inCards : t.phrases.added}</span>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-accent hover:underline disabled:opacity-50"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await addWordCardAction({ term: p.en, meaning: p.hu, sourceType: "phrase", taskId: p.taskIds[0] ?? null });
                            setAdded((s) => new Set(s).add(p.en));
                          })
                        }
                      >
                        {t.phrases.add}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

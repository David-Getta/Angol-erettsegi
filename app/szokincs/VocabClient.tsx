"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import { addDeckAction, addManualWordAction, deleteWordAction, suspendAction, updateWordAction } from "@/app/actions-vocab";
import { useToast } from "@/components/Toast";
import { Badge, btn } from "@/components/ui";
import { speak } from "@/components/speech";

export function AddDeckButton({ deckId }: { deckId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className={btn.small}
      disabled={pending}
      data-testid={`add-deck-${deckId}`}
      onClick={() =>
        start(async () => {
          const n = await addDeckAction(deckId);
          toast(t.vocab.deckAdded(n));
          router.refresh();
        })
      }
    >
      + {t.vocab.addDeck}
    </button>
  );
}

export function ManualAddForm() {
  const [f, setF] = useState({ term: "", meaning: "", example: "", collocation: "" });
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const input = "rounded-md border border-border bg-surface px-2 py-1.5 text-sm";
  return (
    <form
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.term.trim()) return;
        start(async () => {
          const r = await addManualWordAction(f);
          toast(r.incomplete ? `„${r.term}” – ${t.task.cardIncomplete}` : `„${r.term}” – ${t.task.cardAdded}`);
          setF({ term: "", meaning: "", example: "", collocation: "" });
          router.refresh();
        });
      }}
    >
      <input className={input} placeholder={t.vocab.term} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />
      <input className={input} placeholder={t.vocab.meaning} value={f.meaning} onChange={(e) => setF({ ...f, meaning: e.target.value })} />
      <input className={input} placeholder={t.vocab.example} value={f.example} onChange={(e) => setF({ ...f, example: e.target.value })} />
      <input className={input} placeholder={t.vocab.collocation} value={f.collocation} onChange={(e) => setF({ ...f, collocation: e.target.value })} />
      <button className={btn.primary} disabled={pending}>
        +
      </button>
    </form>
  );
}

type Word = { key: string; front: string; back: string; example: string | null; collocation: string | null; incomplete: boolean; ids: number[]; suspended: boolean; types: string[]; due: string };

export function CardTable({ words, language = true }: { words: Word[]; language?: boolean }) {
  const typeLabels = language ? t.vocab.types : t.vocab.typesGeneric;
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState({ back: "", example: "" });
  const router = useRouter();
  if (!words.length) return <p className="text-sm text-muted">{t.common.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <tbody>
          {words.map((w) => (
            <tr key={w.key} className={`border-t border-border align-top ${w.suspended ? "opacity-50" : ""}`}>
              <td className="py-2 pr-2">
                <button type="button" className="mr-1 text-muted hover:text-fg" title="▶" onClick={() => speak(w.front)}>
                  🔊
                </button>
                <b>{w.front}</b>
                {w.incomplete && (
                  <span className="ml-1">
                    <Badge tone="warn">{t.vocab.incomplete}</Badge>
                  </span>
                )}
              </td>
              <td className="py-2 pr-2">
                {edit === w.key ? (
                  <div className="grid gap-1">
                    <input className="rounded border border-border bg-surface px-2 py-1" value={draft.back} placeholder={t.vocab.meaning} onChange={(e) => setDraft({ ...draft, back: e.target.value })} />
                    <input className="rounded border border-border bg-surface px-2 py-1" value={draft.example} placeholder={t.vocab.example} onChange={(e) => setDraft({ ...draft, example: e.target.value })} />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className={btn.small}
                        onClick={async () => {
                          await updateWordAction(w.key, { back: draft.back, example: draft.example || null });
                          setEdit(null);
                          router.refresh();
                        }}
                      >
                        {t.common.save}
                      </button>
                      <button type="button" className={btn.small} onClick={() => setEdit(null)}>
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => {
                      setEdit(w.key);
                      setDraft({ back: w.back, example: w.example ?? "" });
                    }}
                  >
                    {w.back || <i className="text-muted">–</i>}
                    {w.example && <div className="text-xs italic text-muted">{w.example}</div>}
                  </button>
                )}
              </td>
              <td className="py-2 pr-2 text-xs text-muted">{w.types.map((x) => typeLabels[x] ?? x).join(", ")}</td>
              <td className="whitespace-nowrap py-2 text-right">
                <button
                  type="button"
                  className={btn.ghost}
                  onClick={async () => {
                    await suspendAction(w.ids, !w.suspended);
                    router.refresh();
                  }}
                >
                  {w.suspended ? t.vocab.unsuspend : t.vocab.suspend}
                </button>
                <button
                  type="button"
                  className={btn.ghost}
                  onClick={async () => {
                    if (!window.confirm(`${w.front}: ${t.common.delete}?`)) return;
                    await deleteWordAction(w.key);
                    router.refresh();
                  }}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n/hu";
import { normalizeForCheck } from "@/lib/scoring/check";
import { reviewCardAction } from "@/app/actions-vocab";
import { speak } from "@/components/speech";
import { Card, ProgressBar, btn } from "@/components/ui";

export type ReviewCard = {
  id: number;
  type: string;
  front: string;
  back: string;
  example: string | null;
  collocation: string | null;
  /** fix cards: the sentence the mistake was in. */
  context?: string | null;
  cloze: string | null;
  collocationCloze: string | null;
  previews: Record<1 | 2 | 3 | 4, string>;
  isNew: boolean;
};

export function ReviewSession({ initial, ttsRate, language = true }: { initial: ReviewCard[]; ttsRate: number; language?: boolean }) {
  const typeLabels = language ? t.vocab.types : t.vocab.typesGeneric;
  const lang = language ? "en" : "hu";
  const accent = language ? "en-GB" : "hu-HU";
  const [queue, setQueue] = useState(initial);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const card = queue[0];
  const total = initial.length;

  const answerTerm = card && card.type !== "en-hu";
  const accepted = card ? (card.type === "fix" ? card.front.split(" / ") : [card.front]).map(normalizeForCheck) : [];
  const typedOk = card && typed.trim() ? accepted.includes(normalizeForCheck(typed)) : null;

  const rate = useCallback(
    async (r: 1 | 2 | 3 | 4) => {
      if (!card || busy || !shown) return;
      setBusy(true);
      const res = await reviewCardAction(card.id, r, Date.now() - started.current);
      setQueue((q) => {
        const rest = q.slice(1);
        // "again" within the next 15 minutes comes back in this session
        if (new Date(res.dueAt).getTime() - Date.now() < 15 * 60 * 1000) return [...rest, { ...card, previews: res.previews, isNew: false }];
        return rest;
      });
      if (r > 1) setDone((d) => d + 1);
      setShown(false);
      setTyped("");
      started.current = Date.now();
      setBusy(false);
    },
    [busy, card, shown],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" && e.key !== "Enter") return;
      if ((e.key === " " || e.key === "Enter") && !shown) {
        e.preventDefault();
        setShown(true);
        if (card) speak(card.front, { rate: ttsRate, accent });
      } else if (shown && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        void rate(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, rate, shown, ttsRate]);

  if (!card) {
    return (
      <Card title={t.vocab.title}>
        <p className="text-lg" data-testid="review-done">
          {t.vocab.noneDue}
        </p>
        <Link href="/szokincs" className={`${btn.secondary} mt-4`}>
          ← {t.vocab.title}
        </Link>
      </Card>
    );
  }

  let prompt: React.ReactNode;
  if (card.type === "en-hu") prompt = <span className="text-3xl font-semibold">{card.front}</span>;
  else if (card.type === "hu-en") prompt = <span className="text-3xl font-semibold">{card.back}</span>;
  else if (card.type === "cloze") prompt = (
    <div>
      <div lang={lang} className="font-reading text-2xl leading-relaxed">{card.cloze ?? card.example}</div>
      <div className="mt-2 text-sm text-muted">({card.back})</div>
    </div>
  );
  else if (card.type === "fix") prompt = (
    <div className="text-left">
      <div className="mb-2 text-sm text-muted">{t.vocab.fixPrompt}</div>
      {card.context && <div lang={lang} className="mb-2 font-reading text-lg leading-relaxed text-muted">{card.context}</div>}
      <div lang={lang} className="font-reading text-2xl text-bad line-through decoration-bad/50">{card.example}</div>
    </div>
  );
  else prompt = (
    <div>
      <div lang={lang} className="font-reading text-2xl">{card.collocationCloze ?? card.collocation}</div>
      <div className="mt-2 text-sm text-muted">({card.back})</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Link href="/szokincs" className="hover:underline">
          ← {t.vocab.title}
        </Link>
        <div className="flex-1">
          <ProgressBar value={done} max={Math.max(total, done + queue.length)} />
        </div>
        <span>{queue.length}</span>
      </div>
      <Card>
        <div className="mb-3 flex justify-between text-xs text-muted">
          <span>{typeLabels[card.type]}</span>
          {card.isNew && <span>{t.vocab.new}</span>}
        </div>
        <div className="min-h-28 text-center" data-testid="review-prompt">
          {prompt}
        </div>
        {answerTerm && !shown && (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t.vocab.typeAnswer}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            className="mx-auto mt-4 block w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-center"
          />
        )}
        {shown ? (
          <div className="mt-5 border-t border-border pt-4 text-center" data-testid="review-answer">
            {card.type === "en-hu" ? (
              <div className="text-2xl">{card.back}</div>
            ) : (
              <div className="text-2xl font-semibold">
                {card.front}{" "}
                {typedOk !== null && <span className={typedOk ? "text-good" : "text-bad"}>{typedOk ? "✓" : `✗ (${typed})`}</span>}
              </div>
            )}
            {card.type === "fix" ? (
              <div className="mt-2 whitespace-pre-line text-left text-sm">{card.back}</div>
            ) : (
              card.example && <div lang={lang} className="mt-2 font-reading italic text-muted">{card.example}</div>
            )}
            <button type="button" className="mt-2 text-sm text-muted hover:text-fg" onClick={() => speak(card.front, { rate: ttsRate, accent })}>
              🔊
            </button>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => rate(r)}
                  data-testid={`rate-${r}`}
                  className={`${r === 1 ? btn.danger : r === 3 ? btn.primary : btn.secondary} flex-col !gap-0 px-1`}
                >
                  <span>{t.vocab.rate[r]}</span>
                  <span className="text-xs opacity-80">
                    {card.previews[r]} · <kbd>{r}</kbd>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 text-center">
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                setShown(true);
                speak(card.front, { rate: ttsRate, accent });
              }}
              data-testid="show-answer"
            >
              {t.vocab.show} (Szóköz)
            </button>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted">{t.vocab.rateKeys}</p>
      </Card>
    </div>
  );
}

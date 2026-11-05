"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TargetedItem } from "@/lib/targeted";
import type { ItemResult } from "@/lib/scoring/check";
import { t } from "@/lib/i18n/hu";
import { checkTargetedAction, logTargetedTimeAction } from "@/app/actions-practice";
import { ItemFeedback } from "@/components/exercise/ItemFeedback";
import { Card, ProgressBar, btn } from "@/components/ui";
import { useContentLang } from "@/components/ContentLang";

export function TargetedRunner({ items, categoryNames, section = "language-use" }: { items: TargetedItem[]; categoryNames: Record<string, string>; section?: string }) {
  const contentLang = useContentLang();
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ItemResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const done = idx >= items.length;
  const cur = items[idx];

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);
  useEffect(() => {
    if (done) void logTargetedTimeAction((Date.now() - started.current) / 1000, section);
  }, [done]);

  const check = async (value: string) => {
    if (!cur || result || busy || !value.trim()) return;
    setBusy(true);
    const r = await checkTargetedAction(cur.key, value);
    setResult(r.result);
    if (r.result.correct) setCorrect((c) => c + 1);
    setBusy(false);
  };
  const next = () => {
    setIdx((i) => i + 1);
    setAnswer("");
    setResult(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!cur) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (result && (e.key === "Enter" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        next();
        return;
      }
      if (tag === "INPUT") return;
      if (/^[1-9]$/.test(e.key) && !result) {
        const keys = cur.item.kind === "choice" ? cur.item.options.map((o) => o.key) : cur.item.kind === "match" ? (cur.options ?? []).map((o) => o.key) : cur.item.kind === "tf" ? ["T", "F", "NG"] : [];
        const k = keys[Number(e.key) - 1];
        if (k) {
          setAnswer(k);
          void check(k);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    return (
      <Card title={t.languageUse.targetedDone}>
        <div className="text-3xl font-semibold" data-testid="targeted-score">
          {t.languageUse.targetedStats(correct, items.length)}
        </div>
        <button type="button" className={`${btn.primary} mt-4`} onClick={() => router.refresh()}>
          ↻ {t.languageUse.newRound}
        </button>
      </Card>
    );
  }
  const it = cur!.item;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>
          {idx + 1} / {items.length}
        </span>
        <div className="flex-1">
          <ProgressBar value={idx} max={items.length} />
        </div>
        <span>{t.languageUse.targetedStats(correct, idx)}</span>
      </div>
      <Card>
        <div className="text-xs text-muted">
          {categoryNames[it.category]} · {cur!.taskTitle}
        </div>
        <div className="mt-1 text-sm text-muted">{cur!.instructions}</div>
        <div lang={contentLang} className="mt-3 font-reading text-lg leading-relaxed" data-testid="targeted-context">
          {cur!.context}
        </div>
        <div className="mt-4">
          {it.kind === "text" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void check(answer);
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2"
                data-testid="targeted-input"
              />
              {!result && (
                <button type="submit" className={btn.primary} disabled={busy}>
                  {t.task.checkItem}
                </button>
              )}
            </form>
          ) : (
            <div className="grid gap-1.5">
              {(it.kind === "choice" ? it.options : it.kind === "match" ? cur!.options ?? [] : [
                { key: "T", text: t.task.trueFalse.T! },
                { key: "F", text: t.task.trueFalse.F! },
                { key: "NG", text: t.task.trueFalse.NG! },
              ]).map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={!!result}
                  onClick={() => {
                    setAnswer(o.key);
                    void check(o.key);
                  }}
                  className={`flex gap-2 rounded-md border px-3 py-1.5 text-left text-sm ${
                    result && o.key === result.expected ? "border-good bg-good-soft" : result && answer === o.key ? "border-bad bg-bad-soft" : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <b>{o.key}</b> {o.text} <kbd className="ml-auto">{i + 1}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>
        {result && (
          <>
            <ItemFeedback item={it} result={result} categoryName={categoryNames[it.category]} />
            <button type="button" className={`${btn.primary} mt-3`} onClick={next} data-testid="targeted-next">
              {t.common.next} (Enter)
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

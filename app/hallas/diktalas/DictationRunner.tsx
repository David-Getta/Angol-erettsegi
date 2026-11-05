"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DictationSentence } from "@/lib/dictation";
import { compareWords } from "@/lib/scoring/words";
import { logDictationTimeAction } from "@/app/actions-practice";
import { speak, stopSpeaking, useSpeechSupport } from "@/components/speech";
import { Card, ProgressBar, btn } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

export function DictationRunner({ sentences, rate }: { sentences: DictationSentence[]; rate: number }) {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ReturnType<typeof compareWords> | null>(null);
  const [sum, setSum] = useState({ correct: 0, total: 0 });
  const started = useRef(Date.now());
  const { tts, ready } = useSpeechSupport();
  const router = useRouter();
  const s = sentences[idx];

  useEffect(() => () => stopSpeaking(), []);

  const play = (slow = false) => {
    if (!s) return;
    stopSpeaking();
    void speak(s.text, { rate: slow ? Math.max(0.6, rate * 0.75) : rate, gender: s.gender, accent: s.accent });
  };

  const check = () => {
    if (!s) return;
    const r = compareWords(s.text, typed);
    setResult(r);
    setSum((x) => ({ correct: x.correct + r.correct, total: x.total + r.total }));
  };

  const next = () => {
    setIdx((i) => i + 1);
    setTyped("");
    setResult(null);
    if (idx + 1 >= sentences.length) {
      void logDictationTimeAction(Math.round((Date.now() - started.current) / 1000));
    }
  };

  if (!s) {
    return (
      <Card title={t.dictation.done}>
        <p className="text-lg" data-testid="dictation-total">
          {t.dictation.total(sum.correct, sum.total)}
        </p>
        <button type="button" className={`${btn.primary} mt-4`} onClick={() => router.refresh()}>
          ↻ {t.dictation.again}
        </button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <div className="flex-1">
          <ProgressBar value={idx} max={sentences.length} />
        </div>
        <span>
          {idx + 1} / {sentences.length}
        </span>
      </div>
      <Card>
        {ready && !tts && <p className="mb-3 rounded-md bg-warn-soft p-2 text-sm text-warn">{t.dictation.noTts}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={() => play(false)} data-testid="dictation-play">
            {t.dictation.play}
          </button>
          <button type="button" className={btn.secondary} onClick={() => play(true)}>
            {t.dictation.slow}
          </button>
        </div>
        <textarea
          lang="en"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={!!result}
          rows={3}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={t.dictation.type}
          className="mt-3 w-full rounded-md border border-border bg-surface p-3 font-reading text-[17px]"
          data-testid="dictation-input"
          onKeyDown={(e) => {
            if (e.key === " " && e.ctrlKey) {
              e.preventDefault();
              play(false);
            } else if (e.key === "Enter" && !e.shiftKey && typed.trim()) {
              e.preventDefault();
              check();
            }
          }}
        />
        <p className="mt-1 text-xs text-muted">{t.dictation.keys}</p>
        {!result ? (
          <button type="button" className={`${btn.primary} mt-2`} disabled={!typed.trim()} onClick={check} data-testid="dictation-check">
            {t.dictation.check}
          </button>
        ) : (
          <div className="mt-3 space-y-2" data-testid="dictation-result">
            <p className="font-medium">{t.dictation.score(result.correct, result.total)}</p>
            <p lang="en" className="font-reading text-[17px] leading-relaxed">
              {result.tokens.map((tok, i) => (
                <span key={i}>
                  {tok.status === "ok" && <span className="text-good">{tok.word}</span>}
                  {tok.status === "missing" && <span className="text-bad line-through decoration-bad/60">{tok.word}</span>}
                  {tok.status === "wrong" && (
                    <span>
                      <span className="text-bad line-through decoration-bad/60">{tok.typed}</span> <span className="font-semibold text-good">{tok.word}</span>
                    </span>
                  )}
                  {tok.status === "extra" && <span className="text-muted line-through">{tok.word}</span>}{" "}
                </span>
              ))}
            </p>
            <p className="text-xs text-muted">{t.dictation.legend}</p>
            <p className="text-sm">
              <span className="text-muted">{t.dictation.original}: </span>
              <span lang="en" className="font-reading">
                {s.text}
              </span>
            </p>
            <p className="text-xs text-muted">{t.dictation.from(s.taskTitle)}</p>
            <button type="button" className={btn.primary} onClick={next} data-testid="dictation-next" autoFocus>
              {t.dictation.next}
            </button>
          </div>
        )}
      </Card>
      {sum.total > 0 && <p className="text-sm text-muted">{t.dictation.total(sum.correct, sum.total)}</p>}
    </div>
  );
}

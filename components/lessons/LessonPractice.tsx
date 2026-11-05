"use client";

import { useRef, useState, useTransition } from "react";
import type { LessonPracticeItem } from "@/lib/content/schema";
import type { ItemResult } from "@/lib/scoring/check";
import { checkLessonItemAction } from "@/app/actions-practice";
import { ItemFeedback } from "@/components/exercise/ItemFeedback";
import { btn } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

/** Self-check of a Szabálytár lesson: one item at a time, checked on the server, with the explanation shown right away. */
export function LessonPractice({ category, items }: { category: string; items: LessonPracticeItem[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [pending, start] = useTransition();
  const last = useRef(Date.now());

  const check = (item: LessonPracticeItem) => {
    const answer = answers[item.id] ?? "";
    const seconds = Math.round((Date.now() - last.current) / 1000);
    last.current = Date.now();
    start(async () => {
      const r = await checkLessonItemAction({ category, itemId: item.id, answer, seconds });
      if (r) setResults((prev) => ({ ...prev, [item.id]: r }));
    });
  };

  const done = Object.keys(results).length;
  const correct = Object.values(results).filter((r) => r.correct).length;

  return (
    <div>
      <ol className="space-y-4">
        {items.map((item) => {
          const res = results[item.id];
          const locked = !!res;
          return (
            <li key={item.id} className="rounded-lg border border-border p-3" data-testid={`lesson-item-${item.id}`}>
              <div className="flex gap-2">
                <span className="font-semibold text-muted">{item.id}.</span>
                <p className="whitespace-pre-line font-reading text-[15px]">
                  {item.prompt}
                  {item.kind === "text" && item.cue && !item.prompt?.includes(`(${item.cue})`) && <span className="text-muted"> ({item.cue})</span>}
                </p>
              </div>
              <div className="mt-2 pl-6">
                {item.kind === "choice" ? (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-4">
                    {item.options.map((o) => (
                      <label key={o.key} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`lesson-${item.id}`}
                          value={o.key}
                          disabled={locked}
                          checked={answers[item.id] === o.key}
                          onChange={() => setAnswers((a) => ({ ...a, [item.id]: o.key }))}
                        />
                        <span>
                          <b>{o.key}</b> {o.text}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    aria-label={`${t.lessons.yourAnswer} – ${item.id}`}
                    className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                    value={answers[item.id] ?? ""}
                    disabled={locked}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !locked) check(item);
                    }}
                  />
                )}
                {!locked && (
                  <button type="button" className={`${btn.small} mt-2`} disabled={pending || !(answers[item.id] ?? "").trim()} onClick={() => check(item)}>
                    {t.common.check}
                  </button>
                )}
                {res && <ItemFeedback item={item} result={res} lessonLink={false} />}
              </div>
            </li>
          );
        })}
      </ol>
      {done > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium" data-testid="lesson-score">
            {t.lessons.practiceScore(correct, done)}
          </span>
          <button
            type="button"
            className={btn.ghost}
            onClick={() => {
              setAnswers({});
              setResults({});
              last.current = Date.now();
            }}
          >
            {t.lessons.practiceReset}
          </button>
        </div>
      )}
    </div>
  );
}

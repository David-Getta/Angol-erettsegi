"use client";

import Link from "next/link";
import type { Item } from "@/lib/content/schema";
import type { ItemResult } from "@/lib/scoring/check";
import { t } from "@/lib/i18n/hu";

/**
 * Feedback for one item: the given answer, the correct answer and WHY it is
 * correct, where it is in the text, and why the other options are wrong.
 */
export function ItemFeedback({
  item,
  result,
  categoryName,
  lessonLink = true,
}: {
  item: Item;
  result: ItemResult;
  categoryName?: string;
  /** Link to the Szabálytár lesson of the item's category. */
  lessonLink?: boolean;
}) {
  const wrongOptions = item.kind === "choice" || item.kind === "match" ? item.wrongOptions : undefined;
  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-sm ${result.correct ? "border-good/30 bg-good-soft/60" : "border-bad/30 bg-bad-soft/60"}`}
      data-testid={`feedback-${item.id}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`font-semibold ${result.correct ? "text-good" : "text-bad"}`}>
          {result.correct ? `✓ ${t.task.correct}` : `✗ ${t.task.wrong}`}
        </span>
        {!result.correct && (
          <span>
            {t.task.yourAnswer}: <b>{result.given || <i className="font-normal">{t.task.empty}</i>}</b>
          </span>
        )}
        <span>
          {t.task.correctAnswer}: <b data-testid={`correct-${item.id}`}>{result.expectedLabel}</b>
        </span>
        {categoryName && <span className="text-xs text-muted">· {categoryName}</span>}
        {lessonLink && !result.correct && (
          <Link href={`/szabalytar/${item.category}`} className="text-xs text-accent hover:underline" title={t.lessons.lessonLinkTitle} target="_blank">
            § {t.lessons.lessonLink}
          </Link>
        )}
      </div>
      {result.near && <div className="mt-1 text-warn">⚠ {result.correct ? t.task.nearAccepted : t.task.near}</div>}
      <div className="mt-1.5">
        <span className="font-medium">{t.task.why} </span>
        <span className="whitespace-pre-line">{item.explanation}</span>
      </div>
      {item.evidence && (
        <div className="mt-1">
          <span className="font-medium">{t.task.whereInText} </span>
          <mark lang="en" className="font-reading">„{item.evidence}”</mark>
        </div>
      )}
      {wrongOptions && Object.keys(wrongOptions).length > 0 && (
        <details className="mt-1" open={!result.correct}>
          <summary className="cursor-pointer font-medium">{t.task.whyWrong}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {Object.entries(wrongOptions).map(([k, v]) => (
              <li key={k}>
                <b>{k}</b>: {v}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

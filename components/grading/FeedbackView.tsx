"use client";

import Link from "next/link";
import { useState } from "react";
import type { Feedback } from "@/lib/exchange/schema";
import { t } from "@/lib/i18n/hu";
import { AddFixCardButton } from "@/components/vocab/AddFixCardButton";
import { addPhrasesAction } from "@/app/actions-grading";
import { useToast } from "../Toast";
import { Badge, Card, ProgressBar, btn } from "../ui";
import { AnnotatedText } from "./AnnotatedText";

export type CriterionInfo = { id: string; name: string; max: number };

export function FeedbackView({
  submissionId,
  text,
  feedback,
  criteria,
  pointLabels,
  categoryNames,
  examPoints,
}: {
  submissionId: string;
  text: string;
  feedback: Feedback;
  criteria: CriterionInfo[];
  pointLabels: Record<string, string>;
  categoryNames: Record<string, string>;
  examPoints?: { points: number; max: number; note: string } | null;
}) {
  const toast = useToast();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const addPhrases = async (list: Feedback["usefulPhrases"]) => {
    const n = await addPhrasesAction(submissionId, list);
    setAdded((s) => new Set([...s, ...list.map((p) => p.en)]));
    toast(`${n} szókártya felvéve`);
  };
  const nameOf = (id: string) => criteria.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-5" data-testid="feedback-view">
      <Card
        title={t.grading.criteria}
        actions={feedback.gradedBy ? <Badge tone="accent">{t.grading.gradedBy[feedback.gradedBy]}</Badge> : null}
      >
        <table className="w-full text-sm">
          <tbody>
            {feedback.criteria.map((c) => (
              <tr key={c.id} className="border-b border-border align-top last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium">{nameOf(c.id)}</div>
                  <div className="mt-0.5 text-muted">{c.justification}</div>
                </td>
                <td className="w-40 py-2">
                  <div className="text-right font-semibold tabular-nums">
                    {c.score} / {c.max}
                  </div>
                  <ProgressBar value={c.score} max={c.max} tone={c.score / c.max >= 0.6 ? "good" : c.score / c.max >= 0.4 ? "warn" : "bad"} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-semibold">{t.grading.total}</td>
              <td className="pt-3 text-right text-lg font-semibold tabular-nums" data-testid="feedback-total">
                {feedback.totalScore} / {feedback.maxScore}
              </td>
            </tr>
            {examPoints && (
              <tr>
                <td className="text-xs text-muted">{examPoints.note}</td>
                <td className="text-right text-sm text-muted tabular-nums">
                  ≈ {examPoints.points} / {examPoints.max} {t.grading.examPoints}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </Card>

      {feedback.taskPoints.length > 0 && (
        <Card title={t.grading.taskPoints}>
          <ul className="space-y-2 text-sm">
            {feedback.taskPoints.map((p) => (
              <li key={p.id} className="flex gap-3">
                <Badge tone={p.status === "covered" ? "good" : p.status === "partial" ? "warn" : "bad"}>{t.grading.tpStatus[p.status]}</Badge>
                <div>
                  {pointLabels[p.id] && <div className="font-medium">{pointLabels[p.id]}</div>}
                  <div className="text-muted">{p.comment}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`${t.grading.corrections} (${feedback.corrections.length})`}>
        <p className="mb-3 text-xs text-muted">{t.grading.correctionsHint}</p>
        <AnnotatedText text={text} corrections={feedback.corrections} categoryNames={categoryNames} />
        {feedback.corrections.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-1 pr-2">{t.grading.original}</th>
                <th className="pb-1 pr-2">{t.grading.corrected}</th>
                <th className="pb-1">{t.errorLog.why}</th>
              </tr>
            </thead>
            <tbody>
              {feedback.corrections.map((c, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="py-1.5 pr-2 text-bad line-through decoration-bad/50">{c.original}</td>
                  <td className="py-1.5 pr-2 font-medium text-good">{c.corrected}</td>
                  <td className="py-1.5">
                    <Link
                      href={`/szabalytar/${c.category}`}
                      className="mr-1 text-xs text-muted hover:text-accent hover:underline"
                      title={t.lessons.lessonLinkTitle}
                    >
                      [{categoryNames[c.category] ?? c.category}]
                    </Link>
                    {c.explanation}{" "}
                    <AddFixCardButton original={c.original} corrected={c.corrected} explanation={c.explanation} sourceType="grading" sourceId={submissionId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t.grading.priorities}>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm" data-testid="priorities">
            {feedback.priorities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-semibold">{t.grading.summary}</h3>
          <p className="mt-1 text-sm">{feedback.summary}</p>
        </Card>
        <Card
          title={t.writing.usefulPhrases}
          actions={
            feedback.usefulPhrases.length > 0 && (
              <button type="button" className={btn.small} onClick={() => addPhrases(feedback.usefulPhrases.filter((p) => !added.has(p.en)))}>
                + {t.grading.allPhrasesToCards}
              </button>
            )
          }
        >
          <ul className="divide-y divide-border text-sm">
            {feedback.usefulPhrases.map((p) => (
              <li key={p.en} className="flex items-start gap-2 py-1.5">
                <div className="flex-1">
                  <b>{p.en}</b> <span className="text-muted">– {p.hu}</span>
                  {p.example && <div className="text-xs italic text-muted">{p.example}</div>}
                </div>
                <button type="button" className={btn.small} disabled={added.has(p.en)} onClick={() => addPhrases([p])}>
                  {added.has(p.en) ? "✓" : `+ ${t.grading.phraseToCard}`}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t.grading.improved}>
        <div lang="en" className="reading-text whitespace-pre-wrap">{feedback.improvedVersion}</div>
      </Card>
    </div>
  );
}

import type { ReactNode } from "react";
import type { ModelAnswer as ModelAnswerT, WritingTask } from "@/lib/content/schema";
import { quotedPhrases, wordCount } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { AddPhraseChips } from "@/components/vocab/AddPhraseChips";

/** Marks the quotes that cover the guiding points inside the model text. */
function highlight(text: string, covered: ModelAnswerT["pointsCovered"], order: Map<string, number>): ReactNode[] {
  const marks: { start: number; end: number; id: string }[] = [];
  for (const pc of covered) {
    const start = text.indexOf(pc.quote);
    if (start < 0) continue;
    const end = start + pc.quote.length;
    if (marks.some((m) => start < m.end && end > m.start)) continue;
    marks.push({ start, end, id: pc.id });
  }
  marks.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) out.push(text.slice(pos, m.start));
    out.push(
      <mark key={m.start} className="rounded bg-accent-soft px-0.5 text-fg">
        {text.slice(m.start, m.end)}
        <sup className="ml-0.5 text-[10px] font-semibold text-accent">{order.get(m.id) ?? m.id}</sup>
      </mark>,
    );
    pos = m.end;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

/** The model answer of a writing card, with the guiding points marked and the Hungarian notes. */
export function ModelAnswer({ task, open = false }: { task: WritingTask; open?: boolean }) {
  const m = task.modelAnswer;
  if (!m) return null;
  const order = new Map(task.points.map((p, i) => [p.id, i + 1]));
  return (
    <details className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5" open={open} data-testid="model-answer">
      <summary className="cursor-pointer text-base font-semibold">
        {t.writing.modelAnswer} <span className="text-sm font-normal text-muted">· {t.writing.modelAnswerWords(wordCount(m.text))}</span>
      </summary>
      <p className="mt-2 text-sm text-muted">{t.writing.modelAnswerHint}</p>
      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div lang="en" className="reading-text whitespace-pre-wrap rounded-lg border border-border p-3">{highlight(m.text, m.pointsCovered, order)}</div>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="mb-1 font-semibold">{t.writing.modelAnswerPoints}</h3>
            <ol className="list-decimal space-y-1 pl-5">
              {task.points.map((p) => (
                <li key={p.id}>{p.text}</li>
              ))}
            </ol>
          </div>
          {m.notes.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">{t.writing.modelAnswerWhy}</h3>
              <ul className="list-disc space-y-1 pl-5">
                {m.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <AddPhraseChips phrases={quotedPhrases(m.notes, m.text)} taskId={task.id} sourceType="model-answer" />
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

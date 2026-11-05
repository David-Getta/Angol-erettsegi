import type { SpeakingTask } from "@/lib/content/schema";
import { quotedPhrases, wordCount } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { AddPhraseChips } from "@/components/vocab/AddPhraseChips";

/** The sample answer of a speaking task: conversation turns or a monologue, with Hungarian notes. */
export function SampleAnswer({ task, open = false }: { task: SpeakingTask; open?: boolean }) {
  const sa = task.sampleAnswer;
  if (!sa) return null;
  const words = wordCount(
    sa.turns
      .filter((x) => x.speaker === "candidate")
      .map((x) => x.text)
      .join(" "),
  );
  const dialogue = sa.turns.some((x) => x.speaker === "examiner");
  return (
    <details className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5" open={open} data-testid="sample-answer">
      <summary className="cursor-pointer text-base font-semibold">
        {t.sample.title} <span className="text-sm font-normal text-muted">· {t.sample.words(words)}</span>
      </summary>
      <p className="mt-2 text-sm text-muted">{t.sample.hint}</p>
      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <div className="space-y-2">
          {sa.turns.map((turn, i) =>
            turn.speaker === "examiner" ? (
              <p key={i} className="text-sm italic text-muted">
                <b className="not-italic">{t.sample.examiner}:</b> {turn.text}
              </p>
            ) : (
              <p key={i} className="reading-text whitespace-pre-line">
                {dialogue && <b className="font-sans text-sm">{t.sample.candidate}: </b>}
                {turn.text}
              </p>
            ),
          )}
        </div>
        {sa.notes.length > 0 && (
          <div className="text-sm">
            <h3 className="mb-1 font-semibold">{t.sample.why}</h3>
            <ul className="list-disc space-y-1 pl-5">
              {sa.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <AddPhraseChips phrases={quotedPhrases(sa.notes, sa.turns.filter((x) => x.speaker === "candidate").map((x) => x.text).join(" "))} taskId={task.id} sourceType="sample-answer" />
          </div>
        )}
      </div>
    </details>
  );
}

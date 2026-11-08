"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { GlossaryEntry, ObjectiveTask } from "@/lib/content/schema";
import { checkItem, type ItemResult } from "@/lib/scoring/check";
import { t } from "@/lib/i18n/hu";
import { saveAttemptAction, addWordCardAction } from "@/app/actions-practice";
import { ObjectiveTaskView, GlossaryList, itemKeys } from "./ObjectiveTaskView";
import { useTimer, TimerDisplay } from "../useTimer";
import { btn } from "../ui";
import { useToast } from "../Toast";

export type RunnerProps = {
  task: ObjectiveTask;
  mode: "practice" | "exam";
  timeLimitSec: number | null;
  categoryNames: Record<string, string>;
  acceptNearMiss: boolean;
  /** Hungarian number notation for numeric answers (non-language subjects). */
  decimalComma?: boolean;
  backHref: string;
  /** Rendered above the task (e.g. the listening player). */
  before?: (ctx: { finished: boolean; running: boolean }) => ReactNode;
  /** Rendered after finishing (e.g. the transcript). */
  after?: (ctx: { highlight: string[] }) => ReactNode;
  /** Exam timer does not start until this is true (listening: after the audio phase starts). */
  startTimer?: boolean;
  wordCards?: boolean;
  /** Incrementing this number finishes the task (listening: after the last play). */
  autoFinishSignal?: number;
};

export function useFocusMode(on: boolean) {
  useEffect(() => {
    if (on) document.body.dataset.focus = "true";
    else delete document.body.dataset.focus;
    return () => {
      delete document.body.dataset.focus;
    };
  }, [on]);
}

export function PracticeRunner(props: RunnerProps) {
  const { task, mode } = props;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ItemResult | undefined>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(task.items[0]?.id ?? null);
  const [final, setFinal] = useState<{ score: number; maxScore: number; items: ItemResult[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const toast = useToast();
  const finished = final !== null;
  const timerRunning = !finished && (props.startTimer ?? true);
  const { elapsedSec, remainingSec } = useTimer({
    limitSec: mode === "exam" ? props.timeLimitSec : null,
    running: timerRunning,
    onExpire: () => {
      toast(t.task.timeUp);
      void finish(true);
    },
  });
  useFocusMode(mode === "exam" && !finished);

  const itemById = useMemo(() => new Map(task.items.map((i) => [i.id, i])), [task]);

  const check = useCallback(
    (id: string, value?: string) => {
      const item = itemById.get(id);
      if (!item || locked[id]) return;
      const v = value ?? answers[id] ?? "";
      if (!v.trim()) return;
      const r = checkItem(task, item, v, { acceptNearMiss: props.acceptNearMiss, decimalComma: props.decimalComma });
      setResults((prev) => ({ ...prev, [id]: r }));
      setLocked((prev) => ({ ...prev, [id]: true }));
    },
    [answers, itemById, locked, props.acceptNearMiss, props.decimalComma, task],
  );

  const onAnswer = useCallback(
    (id: string, value: string) => {
      if (locked[id] || finished) return;
      setAnswers((prev) => ({ ...prev, [id]: value }));
      const item = itemById.get(id);
      if (mode === "practice" && item && item.kind !== "text" && value) check(id, value);
    },
    [check, finished, itemById, locked, mode],
  );

  async function finish(auto = false) {
    if (saving || finished) return;
    if (!auto && mode === "exam" && !window.confirm(t.task.confirmFinish)) return;
    setSaving(true);
    try {
      const res = await saveAttemptAction({ taskId: task.id, mode, answers, durationSec: elapsedSec });
      setFinal(res);
      const map: Record<string, ItemResult> = {};
      for (const r of res.items) map[r.itemId] = r;
      setResults(map);
      setLocked(Object.fromEntries(task.items.map((i) => [i.id, true])));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setAnswers({});
    setResults({});
    setLocked({});
    setFinal(null);
    setActive(task.items[0]?.id ?? null);
    setRunKey((k) => k + 1);
  }

  // keyboard shortcuts: 1–9 option, Enter check, N next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!active || finished) return;
      const item = itemById.get(active);
      if (!item) return;
      if (/^[1-9]$/.test(e.key)) {
        const keys = itemKeys(task, item);
        const k = keys[Number(e.key) - 1];
        if (k) {
          e.preventDefault();
          onAnswer(item.id, k);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "practice") check(item.id);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        const idx = task.items.findIndex((i) => i.id === active);
        const next = task.items[idx + 1];
        if (next) {
          setActive(next.id);
          document.getElementById(`item-${next.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          (document.querySelector(`[data-testid="gap-${next.id}"]`) as HTMLInputElement | null)?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, check, finished, itemById, mode, onAnswer, task]);

  const onWordClick =
    props.wordCards && (mode === "practice" || finished)
      ? async (word: string, sentence: string) => {
          const r = await addWordCardAction({ term: word, context: sentence, taskId: task.id, sourceType: task.section });
          toast(r.incomplete ? `„${word}” – ${t.task.cardIncomplete}` : `„${word}” – ${t.task.cardAdded}`);
        }
      : undefined;
  const addGlossary = async (g: GlossaryEntry) => {
    await addWordCardAction({ term: g.term, meaning: g.meaning, context: g.example ?? null, taskId: task.id, sourceType: task.section });
    toast(`„${g.term}” – ${t.task.cardAdded}`);
  };

  useEffect(() => {
    if (props.autoFinishSignal && props.autoFinishSignal > 0) void finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoFinishSignal]);

  const unanswered = task.items.filter((i) => !(answers[i.id] ?? "").trim()).length;
  const highlight = finished ? task.items.map((i) => i.id) : Object.keys(results).filter((k) => results[k]);

  return (
    <div key={runKey} className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:top-12">
        {mode === "exam" && remainingSec !== null && !finished && <TimerDisplay sec={remainingSec} label={t.task.remaining} />}
        {mode === "practice" && !finished && <TimerDisplay sec={elapsedSec} label={t.task.elapsed} warnBelow={-1} />}
        {!finished && <span className="text-sm text-muted">{unanswered > 0 ? t.task.unanswered(unanswered) : "✓"}</span>}
        <span className="hidden text-xs text-muted md:inline">{t.task.keyboard}</span>
        <div className="ml-auto flex gap-2">
          {!finished ? (
            <button type="button" className={btn.primary} onClick={() => finish()} disabled={saving} data-testid="finish">
              {mode === "exam" ? t.task.finishExam : t.task.checkAll}
            </button>
          ) : (
            <>
              <button type="button" className={btn.secondary} onClick={restart}>
                {t.task.tryAgain}
              </button>
              <Link href={props.backHref} className={btn.secondary}>
                {t.task.backToList}
              </Link>
            </>
          )}
        </div>
      </div>

      {final && (
        <div className="rounded-xl border border-border bg-surface p-4" data-testid="result-summary">
          <div className="text-sm text-muted">{t.task.resultTitle}</div>
          <div className="text-3xl font-semibold tabular-nums">
            {final.score} / {final.maxScore} {t.common.points}{" "}
            <span className="text-lg text-muted">({Math.round((final.score / Math.max(1, final.maxScore)) * 100)}%)</span>
          </div>
        </div>
      )}

      {props.before?.({ finished, running: timerRunning })}

      <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-sm">
        <div className="font-medium">{task.instructions}</div>
        {task.instructionsHu && <div className="mt-1 text-muted">{task.instructionsHu}</div>}
        {onWordClick && <div className="mt-1 text-xs text-muted">{t.task.clickWordHint}</div>}
      </div>

      <ObjectiveTaskView
        task={task}
        answers={answers}
        onAnswer={onAnswer}
        results={results}
        locked={locked}
        activeItem={active}
        onActivate={setActive}
        onCheckItem={mode === "practice" ? (id) => check(id) : undefined}
        highlight={highlight}
        onWordClick={onWordClick}
        categoryNames={props.categoryNames}
      />

      {task.section === "reading" && (mode === "practice" || finished) && <GlossaryList glossary={task.glossary} onAdd={addGlossary} />}
      {finished && props.after?.({ highlight })}
    </div>
  );
}

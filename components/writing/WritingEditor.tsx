"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { WritingTask } from "@/lib/content/schema";
import { wordCount } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { createSubmissionAction } from "@/app/actions-grading";
import { useTimer, TimerDisplay } from "@/components/useTimer";
import { useFocusMode } from "@/components/exercise/PracticeRunner";
import { Card, btn } from "@/components/ui";
import { useContentLang } from "@/components/ContentLang";

export function WritingEditor({
  base,
  task,
  mode,
  parent,
  examMinutes,
  mockExamId,
  onSubmitted,
  hideModeSwitch,
  limitSecOverride,
}: {
  /** URL of the part (e.g. /iras) – submissions open under <base>/beadas/<id>. */
  base: string;
  task: WritingTask;
  mode: "practice" | "exam" | "mock";
  parent: { id: string; text: string; version: number } | null;
  examMinutes: number;
  mockExamId?: number;
  onSubmitted?: (id: string) => void;
  hideModeSwitch?: boolean;
  limitSecOverride?: number | null;
}) {
  const contentLang = useContentLang();
  const draftKey = `draft:${task.id}:${parent?.id ?? "new"}`;
  const [text, setText] = useState(parent?.text ?? "");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const exam = mode !== "practice";
  const limitSec = limitSecOverride !== undefined ? limitSecOverride : exam ? examMinutes * 60 : null;
  const { elapsedSec, remainingSec } = useTimer({ limitSec, running: !pending });
  useFocusMode(mode === "exam");

  useEffect(() => {
    if (parent || mode === "mock") return;
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setText(d);
    } catch {
      /* ignore */
    }
  }, [draftKey, parent, mode]);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, text);
        setSavedAt(Date.now());
      } catch {
        /* ignore */
      }
    }, 800);
    return () => clearTimeout(id);
  }, [draftKey, text]);

  const wc = useMemo(() => wordCount(text), [text]);
  const { min, max } = task.wordLimit ?? { min: 0, max: Infinity };
  const wcState = wc < min ? "short" : wc > max ? "long" : "ok";
  const checklist = [
    { id: "points", label: t.writing.checklistItems.points },
    { id: "words", label: `${t.writing.checklistItems.words} (${min}–${max})` },
    { id: "greeting", label: t.writing.checklistItems.greeting },
    { id: "register", label: t.writing.checklistItems.register },
    { id: "paragraphs", label: t.writing.checklistItems.paragraphs },
    { id: "reread", label: t.writing.checklistItems.reread },
    ...task.checklistExtra.map((c, i) => ({ id: `x${i}`, label: c })),
  ];

  const submit = () => {
    if (!text.trim()) return;
    if (!window.confirm(t.writing.submitConfirm)) return;
    start(async () => {
      const r = await createSubmissionAction({
        kind: "writing",
        taskId: task.id,
        text,
        mode: mode === "mock" ? "mock" : mode,
        durationSec: elapsedSec,
        parentId: parent?.id ?? null,
        mockExamId: mockExamId ?? null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      if (onSubmitted) onSubmitted(r.id);
      else router.push(`${base}/beadas/${r.id}`);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-4">
        {!hideModeSwitch && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`${base}/${task.id}${parent ? `?parent=${parent.id}` : ""}`} className={mode === "practice" ? btn.primary : btn.secondary}>
              {t.mode.practice}
            </Link>
            <Link href={`${base}/${task.id}?mode=exam${parent ? `&parent=${parent.id}` : ""}`} className={mode === "exam" ? btn.primary : btn.secondary}>
              {t.mode.exam}
            </Link>
            <span className="text-xs text-muted">{mode === "exam" ? t.mode.examHint : t.mode.practiceHint}</span>
          </div>
        )}
        <Card title={t.writing.situation}>
          <div className="whitespace-pre-line" data-testid="situation">
            {task.situation}
          </div>
          {task.situationHu && <p className="mt-2 text-sm text-muted">{task.situationHu}</p>}
          {task.stimulus && <blockquote lang={contentLang} className="mt-3 whitespace-pre-line border-l-4 border-border pl-3 font-reading text-[15px]">{task.stimulus}</blockquote>}
          <h3 className="mt-4 text-sm font-semibold">{t.writing.points}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {task.points.map((p) => (
              <li key={p.id}>{p.text}</li>
            ))}
          </ul>
          <div className="mt-3 text-sm text-muted">
            {task.wordLimit && `${t.writing.wordLimit}: ${min}–${max} ${t.common.words} · `}
            {task.register && `${t.writing.register[task.register] ?? task.register} · `}
            {t.writing.suggested(task.suggestedMinutes)}
          </div>
          <p className="mt-2 text-xs text-muted">{t.writing.modelHint}</p>
        </Card>
        {parent && (
          <Card title={t.writing.rewrite}>
            <p className="text-sm text-muted">{t.writing.rewriteIntro}</p>
          </Card>
        )}
        {mode === "practice" && task.usefulPhrases.length > 0 && (
          <details className="rounded-xl border border-border bg-surface p-4 text-sm">
            <summary className="cursor-pointer font-semibold">{t.writing.usefulPhrases}</summary>
            <ul className="mt-2 space-y-1">
              {task.usefulPhrases.map((p) => (
                <li key={p.en}>
                  <b>{p.en}</b> <span className="text-muted">– {p.hu}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {remainingSec !== null ? <TimerDisplay sec={remainingSec} label={t.task.remaining} /> : <TimerDisplay sec={elapsedSec} label={t.task.elapsed} warnBelow={-1} />}
          <span
            data-testid="word-count"
            className={`rounded-md px-2 py-1 text-sm font-medium tabular-nums ${wcState === "ok" ? "bg-good-soft text-good" : wc === 0 ? "bg-surface-2 text-muted" : "bg-warn-soft text-warn"}`}
          >
            {t.writing.wordCount(wc)} · {wcState === "ok" ? t.writing.inRange : wcState === "short" ? t.writing.tooShort : t.writing.tooLong}
          </span>
          {savedAt && mode !== "mock" && <span className="text-xs text-muted">{t.writing.draftSaved}</span>}
        </div>
        {exam && <p className="text-xs text-muted">{t.writing.spellcheckOff}</p>}
        <textarea lang={contentLang}
          data-testid="writing-editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={!exam}
          autoCorrect={exam ? "off" : "on"}
          autoCapitalize="sentences"
          placeholder={t.writing.editorPlaceholder}
          rows={18}
          className="w-full rounded-xl border border-border bg-surface p-4 font-reading text-[17px] leading-relaxed"
        />
        <Card title={t.writing.checklist}>
          <ul className="space-y-1.5 text-sm">
            {checklist.map((c) => (
              <li key={c.id}>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={!!checks[c.id]} onChange={(e) => setChecks({ ...checks, [c.id]: e.target.checked })} className="mt-1" />
                  <span>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t.writing.checklistNote}</p>
        </Card>
        {error && <div className="rounded-md border border-bad/40 bg-bad-soft p-2 text-sm text-bad">{error}</div>}
        <button type="button" className={btn.primary} disabled={pending || !text.trim()} onClick={submit} data-testid="submit-writing">
          {t.writing.submit}
        </button>
      </div>
    </div>
  );
}

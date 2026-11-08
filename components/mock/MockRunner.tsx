"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ObjectiveTask, WritingTask } from "@/lib/content/schema";
import { wordCount } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { startPartAction, submitPartAction, abandonMockAction } from "@/app/actions-mock";
import { ObjectiveTaskView } from "../exercise/ObjectiveTaskView";
import { ListeningPlayer } from "../listening/ListeningRunner";
import { useFocusMode } from "../exercise/PracticeRunner";
import { TimerDisplay, fmtClock } from "../useTimer";
import { Card, btn } from "../ui";
import { useContentLang } from "@/components/ContentLang";

export type RunnerPart = { index: number; total: number; part: string; name: string; timeSec: number; started: boolean; secondsLeft: number | null };

export function MockRunner({
  mockId,
  kind,
  part,
  objective,
  writing,
  categoryNames,
  tts,
}: {
  mockId: number;
  kind: "mock" | "diagnostic";
  part: RunnerPart;
  objective: ObjectiveTask[];
  writing: WritingTask[];
  categoryNames: Record<string, string>;
  tts: { rate: number; female: string | null; male: string | null; prepSeconds: number; pauseSeconds: number };
}) {
  const contentLang = useContentLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const storageKey = `mock:${mockId}:${part.index}`;
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(part.secondsLeft);
  const submitted = useRef(false);
  const startedAt = useRef(Date.now());
  useFocusMode(part.started);

  // restore autosaved answers (reload during a part)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw) as { answers: typeof answers; texts: typeof texts };
        setAnswers(d.answers ?? {});
        setTexts(d.texts ?? {});
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, texts }));
    } catch {
      /* ignore */
    }
  }, [answers, texts, storageKey]);

  const submit = useCallback(
    (auto: boolean) => {
      if (submitted.current) return;
      if (!auto && !window.confirm(t.mock.nextPartConfirm)) return;
      submitted.current = true;
      // read the latest autosave so an expiring timer never loses answers
      let a = answers;
      let w = texts;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const d = JSON.parse(raw);
          a = d.answers ?? a;
          w = d.texts ?? w;
        }
      } catch {
        /* ignore */
      }
      start(async () => {
        await submitPartAction(mockId, part.index, a, w, Math.round((Date.now() - startedAt.current) / 1000));
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        router.refresh();
      });
    },
    [answers, mockId, part.index, router, storageKey, texts],
  );

  // `submit` changes with every keystroke (it closes over the answers): keep the latest in a ref so the
  // countdown below is not restarted – restarting it reset the clock to the page-load value while typing
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // server-anchored countdown: the deadline is fixed once when the part is shown
  const deadline = useRef<number | null>(null);
  useEffect(() => {
    if (!part.started || part.secondsLeft === null) return;
    if (deadline.current === null) deadline.current = Date.now() + part.secondsLeft * 1000;
    const end = deadline.current;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(id);
        submitRef.current(true);
      }
    };
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [part.started, part.secondsLeft]);

  const answered = useMemo(() => {
    const totalItems = objective.reduce((n, x) => n + x.items.length, 0);
    const done = objective.reduce((n, x) => n + x.items.filter((i) => (answers[x.id]?.[i.id] ?? "").trim()).length, 0);
    return { totalItems, done };
  }, [answers, objective]);

  if (!part.started) {
    return (
      <Card title={`${t.mock.part(part.index + 1, part.total)}: ${part.name}`}>
        <p className="text-sm">
          ⏱ {fmtClock(part.timeSec)} · {part.part === "writing" ? `${writing.length} feladat` : `${objective.length} feladat`}
        </p>
        <p className="mt-2 text-sm text-muted">{t.mock.intro}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btn.primary} disabled={pending} onClick={() => start(async () => { await startPartAction(mockId); router.refresh(); })} data-testid="start-part">
            ▶ {t.common.start}
          </button>
          <button
            type="button"
            className={btn.ghost}
            onClick={() =>
              window.confirm(t.mock.abandonConfirm) &&
              start(async () => {
                await abandonMockAction(mockId);
                router.push(kind === "mock" ? "/probaerettsegi" : "/szintfelmero");
              })
            }
          >
            {t.mock.abandon}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <b>
          {t.mock.part(part.index + 1, part.total)}: {part.name}
        </b>
        {left !== null && <TimerDisplay sec={left} label={t.task.remaining} />}
        {part.part !== "writing" && (
          <span className="text-sm text-muted">
            {answered.done} / {answered.totalItems}
          </span>
        )}
        <button type="button" className={`${btn.primary} ml-auto`} disabled={pending} onClick={() => submit(false)} data-testid="close-part">
          {part.index + 1 < part.total ? t.mock.nextPart : t.task.finishExam}
        </button>
      </div>

      {objective.map((task, i) => (
        <section key={task.id} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {i + 1}. feladat {task.source === "official" ? "🏛" : ""}
          </h2>
          <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-sm font-medium">{task.instructions}</div>
          {task.section === "listening" && task.listening && (
            <ListeningPlayer task={task} mode="mock" rate={tts.rate} voices={{ female: tts.female, male: tts.male }} prepSeconds={tts.prepSeconds} pauseSeconds={tts.pauseSeconds} />
          )}
          <ObjectiveTaskView
            task={task}
            answers={answers[task.id] ?? {}}
            onAnswer={(itemId, value) => setAnswers((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] ?? {}), [itemId]: value } }))}
            results={{}}
            locked={{}}
            activeItem={active}
            onActivate={setActive}
            highlight={[]}
            categoryNames={categoryNames}
          />
        </section>
      ))}

      {writing.map((task) => {
        const wc = wordCount(texts[task.id] ?? "");
        return (
          <section key={task.id} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card title={`${task.taskNumber}. feladat`}>
              <div className="whitespace-pre-line">{task.situation}</div>
              {task.stimulus && <blockquote lang={contentLang} className="mt-3 whitespace-pre-line border-l-4 border-border pl-3 font-reading text-[15px]">{task.stimulus}</blockquote>}
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {task.points.map((p) => (
                  <li key={p.id}>{p.text}</li>
                ))}
              </ul>
              {task.wordLimit && (
                <div className="mt-2 text-sm text-muted">
                  {t.writing.wordLimit}: {task.wordLimit.min}–{task.wordLimit.max} {t.common.words}
                </div>
              )}
            </Card>
            <div>
              <div className={`mb-1 text-sm tabular-nums ${task.wordLimit && wc >= task.wordLimit.min && wc <= task.wordLimit.max ? "text-good" : "text-muted"}`}>{t.writing.wordCount(wc)}</div>
              <textarea lang={contentLang}
                value={texts[task.id] ?? ""}
                onChange={(e) => setTexts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                spellCheck={false}
                autoCorrect="off"
                rows={16}
                data-testid={`mock-writing-${task.taskNumber}`}
                className="w-full rounded-xl border border-border bg-surface p-4 font-reading text-[17px] leading-relaxed"
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

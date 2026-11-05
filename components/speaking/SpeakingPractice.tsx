"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpeakingTask } from "@/lib/content/schema";
import { t } from "@/lib/i18n/hu";
import { createSubmissionAction } from "@/app/actions-grading";
import { CopyButton } from "@/components/CopyButton";
import { Card, btn, Badge } from "@/components/ui";
import { hasRecorder, speak, startAudioRecording, startDictation, stopSpeaking, useSpeechSupport } from "@/components/speech";
import { fmtClock } from "@/components/useTimer";

type Turn = { q: string | null; a: string };

/** The list of examiner prompts the app reads aloud one by one. */
function examinerTurns(task: SpeakingTask): string[] {
  if (task.type === "interview") return task.questions.flatMap((q) => [q.q]);
  const first =
    task.situation?.examinerOpening ??
    (task.type === "debate" && task.debate
      ? `Here is the statement: ${task.debate.statement}. You are ${task.debate.candidatePosition === "for" ? "for" : "against"} this statement. Please start.`
      : task.type === "picture"
        ? "Please look at the pictures, describe them and compare them."
        : task.prompts[0] ?? task.title);
  return [first, ...task.followUpQuestions];
}

/**
 * Practice of one oral task. `language`: a foreign-language subject – the
 * questions are read aloud and dictated in English; for other subjects the
 * recogniser and the TTS use Hungarian.
 */
export function SpeakingPractice({ task, examinerPrompt, ttsRate, base, language = true, speechLang = "en-GB" }: { task: SpeakingTask; examinerPrompt: string; ttsRate: number; base: string; language?: boolean; speechLang?: string }) {
  const [tab, setTab] = useState<"self" | "live">("self");
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <TaskCard task={task} />
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" className={tab === "self" ? btn.primary : btn.secondary} onClick={() => setTab("self")}>
            🎙 {t.speaking.selfPractice}
          </button>
          <button type="button" className={tab === "live" ? btn.primary : btn.secondary} onClick={() => setTab("live")} data-testid="tab-live">
            💬 {t.speaking.live}
          </button>
        </div>
        {tab === "self" ? <SelfPractice task={task} ttsRate={ttsRate} base={base} language={language} speechLang={speechLang} /> : <LivePractice task={task} examinerPrompt={examinerPrompt} base={base} />}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: SpeakingTask }) {
  return (
    <Card>
      <p className="text-sm">{task.instructionsHu}</p>
      {task.questions.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{t.speaking.questions}</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-[15px]">
            {task.questions.map((q) => (
              <li key={q.q}>
                {q.q}
                {q.followUps.length > 0 && <div className="text-sm text-muted">→ {q.followUps.join(" / ")}</div>}
              </li>
            ))}
          </ol>
        </>
      )}
      {task.situation && (
        <div className="mt-4 space-y-2 text-[15px]">
          <p>{task.situation.context}</p>
          <p>
            <b>Te:</b> {task.situation.candidateRole}
            <br />
            <b>Vizsgáztató:</b> {task.situation.examinerRole}
          </p>
          <h3 className="text-sm font-semibold">{t.speaking.goals}</h3>
          <ul className="list-disc pl-5">
            {task.situation.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {task.scenes.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{t.speaking.scenes}</h3>
          <div className="mt-1 grid gap-2">
            {task.scenes.map((s, i) => (
              <div key={i} className="rounded-lg border border-dashed border-border bg-surface-2/50 p-3 text-[15px] italic">
                🖼 {i + 1}. {s.description}
              </div>
            ))}
          </div>
        </>
      )}
      {task.prompts.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-[15px]">
          {task.prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {task.debate && (
        <div className="mt-4 space-y-2">
          <div className="rounded-lg bg-accent-soft p-3 text-lg font-medium">„{task.debate.statement}”</div>
          <Badge tone="accent">{t.speaking.position[task.debate.candidatePosition]}</Badge>
          <p className="text-xs text-muted">{t.speaking.positionFixed}</p>
          {task.debate.candidateIdeas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">{t.speaking.yourIdeas}</summary>
              <ul className="mt-1 list-disc pl-5">
                {task.debate.candidateIdeas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">{t.speaking.examinerArgs}</summary>
            <ul className="mt-1 list-disc pl-5">
              {task.debate.examinerArguments.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {task.followUpQuestions.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{t.speaking.followUps}</h3>
          <ul className="mt-1 list-disc pl-5 text-[15px]">
            {task.followUpQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      {task.usefulPhrases.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">{t.writing.usefulPhrases}</summary>
          <ul className="mt-1 space-y-0.5">
            {task.usefulPhrases.map((p) => (
              <li key={p.en}>
                <b>{p.en}</b> <span className="text-muted">– {p.hu}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function SelfPractice({ task, ttsRate, base: basePath, language, speechLang }: { task: SpeakingTask; ttsRate: number; base: string; language: boolean; speechLang: string }) {
  const lang = speechLang;
  const turnsQ = examinerTurns(task);
  const [step, setStep] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [current, setCurrent] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [usedAsr, setUsedAsr] = useState(false);
  const [pending, start] = useTransition();
  const dictation = useRef<{ stop: () => void } | null>(null);
  const totalStart = useRef<number | null>(null);
  const router = useRouter();
  const { asr, ready } = useSpeechSupport();
  const [keepVoice, setKeepVoice] = useState(true);
  const [clips, setClips] = useState<Record<number, string>>({});
  const audio = useRef<{ stop: () => Promise<string | null> } | null>(null);
  const canRecord = ready && hasRecorder();

  const allUrls = useRef<string[]>([]);
  const stopAudio = async (turn: number) => {
    const a = audio.current;
    audio.current = null;
    const url = a ? await a.stop() : null;
    if (url) {
      allUrls.current.push(url);
      setClips((c) => ({ ...c, [turn]: url }));
    }
  };
  // blob URLs are freed only when the page is left
  useEffect(
    () => () => {
      void audio.current?.stop();
      allUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);
  useEffect(() => () => dictation.current?.stop(), []);

  const question = turnsQ[step] ?? null;
  const perTurn = Math.round(task.speakingSeconds / Math.max(1, turnsQ.length));

  const toggle = () => {
    if (recording) {
      dictation.current?.stop();
      dictation.current = null;
      setRecording(false);
      setInterim("");
      void stopAudio(step);
      return;
    }
    if (keepVoice && canRecord) void startAudioRecording().then((a) => (audio.current = a));
    stopSpeaking();
    totalStart.current ??= Date.now();
    setAsrError(null);
    const base = current;
    if (asr) {
      dictation.current = startDictation({
        lang,
        onText: (fin, int) => {
          setCurrent(`${base} ${fin}`.trim());
          setInterim(int);
        },
        onError: (e) => setAsrError(e),
      });
      setUsedAsr(true);
    }
    setRecording(true);
  };

  const nextTurn = () => {
    dictation.current?.stop();
    void stopAudio(step);
    setRecording(false);
    setTurns((ts) => [...ts, { q: question, a: current.trim() }]);
    setCurrent("");
    setInterim("");
    setSeconds(0);
    setStep((s) => s + 1);
    const nq = turnsQ[step + 1];
    if (nq) void speak(nq, { rate: ttsRate, accent: lang });
  };

  const transcript = [...turns, ...(current.trim() ? [{ q: question, a: current.trim() }] : [])]
    .map((x) => `${x.q ? `EXAMINER: ${x.q}\n` : ""}CANDIDATE: ${x.a}`)
    .join("\n");

  const submit = () =>
    start(async () => {
      dictation.current?.stop();
      const r = await createSubmissionAction({
        kind: "speaking",
        taskId: task.id,
        text: transcript,
        mode: "practice",
        durationSec: totalStart.current ? (Date.now() - totalStart.current) / 1000 : 0,
        transcriptSource: usedAsr ? "app-asr" : "typed",
      });
      if (r.ok) router.push(`${basePath}/beadas/${r.id}`);
    });

  const finished = step >= turnsQ.length;

  return (
    <Card>
      <p className="text-sm text-muted">{t.speaking.selfPracticeHint}</p>
      {!asr && <p className="mt-2 rounded-md bg-warn-soft p-2 text-sm text-warn">{t.speaking.noAsr}</p>}
      {!finished ? (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-muted">
            {step + 1} / {turnsQ.length}
          </div>
          <div className="rounded-lg bg-surface-2 p-3 text-lg">{question}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} onClick={() => speak(question ?? "", { rate: ttsRate, accent: lang })}>
              🔊 {t.speaking.readQuestion}
            </button>
            {(asr || (canRecord && keepVoice)) && (
              <button type="button" className={recording ? btn.danger : btn.primary} onClick={toggle} data-testid="record">
                {recording ? `■ ${t.speaking.stopRecord}` : `● ${t.speaking.record}`}
              </button>
            )}
            <span className={`font-mono text-sm tabular-nums ${seconds > perTurn ? "text-bad" : "text-muted"}`}>
              {fmtClock(seconds)} / {fmtClock(perTurn)}
            </span>
            {recording && <span className="animate-pulse text-sm text-bad">● {t.speaking.recording}</span>}
          </div>
          {asrError && <p className="text-sm text-bad">⚠ {asrError}</p>}
          {canRecord && (
            <label className="flex items-center gap-2 text-sm" title={t.voice.keepHint}>
              <input type="checkbox" checked={keepVoice} onChange={(e) => setKeepVoice(e.target.checked)} disabled={recording} />
              {t.voice.keep}
            </label>
          )}
          {clips[step] && !recording && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t.voice.yourVoice}:</span>
              <audio controls src={clips[step]} className="h-8" data-testid="voice-clip" />
            </div>
          )}
          <label className="block text-sm font-medium">
            {t.speaking.transcript}
            <textarea lang="en"
              value={current + (interim ? ` ${interim}` : "")}
              onChange={(e) => setCurrent(e.target.value)}
              rows={5}
              data-testid="speaking-transcript"
              className="mt-1 w-full rounded-md border border-border bg-surface p-2 font-reading text-[15px]"
            />
          </label>
          <p className="text-xs text-muted">{t.speaking.transcriptHint}</p>
          <button type="button" className={btn.secondary} onClick={nextTurn} disabled={!current.trim()} data-testid="next-turn">
            {step + 1 < turnsQ.length ? `${t.common.next} →` : `✓ ${t.common.finish}`}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <pre lang="en" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-reading text-sm">{transcript}</pre>
          {Object.keys(clips).length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="text-muted">{t.voice.yourVoice}</div>
              {Object.entries(clips).map(([i, url]) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-right text-muted">{Number(i) + 1}.</span>
                  <audio controls src={url} className="h-8" />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className={btn.primary} onClick={submit} disabled={pending || !transcript.trim()} data-testid="submit-speaking">
              {t.speaking.submit}
            </button>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setTurns([]);
                setStep(0);
                setClips({});
              }}
            >
              {t.common.restart}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function LivePractice({ task, examinerPrompt, base: basePath }: { task: SpeakingTask; examinerPrompt: string; base: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card>
      <p className="text-sm text-muted">{t.speaking.liveHint}</p>
      <div className="mt-3">
        <CopyButton text={examinerPrompt} variant="primary" label={t.speaking.copyExaminer} testId="copy-examiner" />
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Prompt</summary>
        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2">{examinerPrompt}</pre>
      </details>
      <label className="mt-4 block text-sm font-medium">
        {t.speaking.pasteTranscript}
        <textarea lang="en" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"EXAMINER: …\nCANDIDATE: …"} className="mt-1 w-full rounded-md border border-border bg-surface p-2 font-reading text-[15px]" data-testid="live-transcript" />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="button"
        className={`${btn.primary} mt-2`}
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            const r = await createSubmissionAction({ kind: "speaking", taskId: task.id, text, mode: "practice", durationSec: 0, transcriptSource: "claude-voice" });
            if (r.ok) router.push(`${basePath}/beadas/${r.id}`);
            else setError(r.error);
          })
        }
        data-testid="submit-live"
      >
        {t.speaking.submit}
      </button>
    </Card>
  );
}

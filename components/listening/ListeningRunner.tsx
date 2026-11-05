"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ObjectiveTask } from "@/lib/content/schema";
import { findLoose, segmentText } from "@/lib/content/text";
import { t } from "@/lib/i18n/hu";
import { PracticeRunner, type RunnerProps } from "../exercise/PracticeRunner";
import { pickVoice, speak, stopSpeaking, useSpeechSupport, voicesReady, type Gender } from "../speech";
import { fmtClock } from "../useTimer";
import { btn } from "../ui";

type Phase = "idle" | "prep" | "play" | "pause" | "after" | "done";

export function ListeningRunner(props: RunnerProps & { ttsRate: number; voices: { female: string | null; male: string | null }; prepSeconds?: number; pauseSeconds?: number }) {
  const [signal, setSignal] = useState(0);
  const [started, setStarted] = useState(false);
  return (
    <PracticeRunner
      {...props}
      timeLimitSec={null}
      startTimer={started}
      autoFinishSignal={signal}
      before={({ finished }) =>
        finished ? null : (
          <ListeningPlayer
            task={props.task}
            mode={props.mode}
            rate={props.ttsRate}
            voices={props.voices}
            prepSeconds={props.prepSeconds}
            pauseSeconds={props.pauseSeconds}
            onStart={() => setStarted(true)}
            onDone={() => {
              if (props.mode === "exam") setSignal((n) => n + 1);
            }}
          />
        )
      }
      after={({ highlight }) => <Transcript task={props.task} highlight={highlight} />}
    />
  );
}

export function ListeningPlayer({
  task,
  mode,
  rate,
  voices,
  prepSeconds,
  pauseSeconds,
  onStart,
  onDone,
}: {
  task: ObjectiveTask;
  mode: "practice" | "exam" | "mock";
  rate: number;
  voices: { female: string | null; male: string | null };
  prepSeconds?: number;
  pauseSeconds?: number;
  onStart?: () => void;
  onDone?: () => void;
}) {
  const L = task.listening!;
  const plays = L.plays ?? 2;
  const prep = L.prepSeconds ?? prepSeconds ?? 60;
  const pause = L.pauseSeconds ?? pauseSeconds ?? 30;
  const [phase, setPhase] = useState<Phase>("idle");
  const [play, setPlay] = useState(0);
  const [line, setLine] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const cancelled = useRef(false);
  const skip = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const official = task.source === "official" && task.official?.folder && (L.audioFile ?? task.official.audioFile);
  const audioSrc = official
    ? `/api/official-audio?folder=${encodeURIComponent(task.official!.folder!)}&file=${encodeURIComponent((L.audioFile ?? task.official!.audioFile)!)}`
    : null;
  const { tts } = useSpeechSupport();

  useEffect(() => () => {
    cancelled.current = true;
    stopSpeaking();
  }, []);

  const wait = (sec: number) =>
    new Promise<void>((resolve) => {
      let left = sec;
      setCountdown(left);
      const id = setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0 || cancelled.current) {
          clearInterval(id);
          skip.current = null;
          resolve();
        }
      }, 1000);
      skip.current = () => {
        clearInterval(id);
        skip.current = null;
        resolve();
      };
    });

  const speakerVoices = useMemo(() => new Map<string, { voiceURI: string | null; pitch: number }>(), []);

  async function assignVoices() {
    await voicesReady();
    const used = new Set<string>();
    const counts = new Map<string, number>();
    for (const sp of L.speakers) {
      const pref = sp.gender === "female" ? voices.female : voices.male;
      const v = pickVoice({ gender: sp.gender as Gender, accent: sp.accent, voiceURI: pref && !used.has(pref) ? pref : null, avoid: used });
      const uri = v?.voiceURI ?? null;
      const n = counts.get(uri ?? "") ?? 0;
      counts.set(uri ?? "", n + 1);
      if (uri) used.add(uri);
      // same voice for two speakers → shift the pitch so they still sound different
      speakerVoices.set(sp.id, { voiceURI: uri, pitch: n === 0 ? 1 : n % 2 === 1 ? 0.8 : 1.2 });
    }
  }

  async function playOnce() {
    if (audioSrc && audioRef.current) {
      const a = audioRef.current;
      a.currentTime = task.official?.audioStartSec ?? 0;
      await a.play();
      await new Promise<void>((resolve) => {
        const end = task.official?.audioEndSec;
        const onTime = () => {
          if ((end && a.currentTime >= end) || cancelled.current) {
            a.pause();
            done();
          }
        };
        const done = () => {
          a.removeEventListener("timeupdate", onTime);
          a.removeEventListener("ended", done);
          resolve();
        };
        a.addEventListener("timeupdate", onTime);
        a.addEventListener("ended", done);
      });
      return;
    }
    for (let i = 0; i < L.script.length; i++) {
      if (cancelled.current) return;
      setLine(i);
      const l = L.script[i]!;
      const v = speakerVoices.get(l.speaker);
      const gender = L.speakers.find((s) => s.id === l.speaker)?.gender as Gender | undefined;
      await speak(l.text, { rate, voiceURI: v?.voiceURI ?? null, pitch: v?.pitch ?? 1, gender });
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  async function run() {
    cancelled.current = false;
    onStart?.();
    await assignVoices();
    setPhase("prep");
    await wait(prep);
    for (let p = 1; p <= plays; p++) {
      if (cancelled.current) return;
      setPlay(p);
      setPhase("play");
      await playOnce();
      if (p < plays) {
        setPhase("pause");
        await wait(pause);
      }
    }
    if (cancelled.current) return;
    setPhase("after");
    await wait(pause);
    setPhase("done");
    onDone?.();
  }

  const status =
    phase === "prep"
      ? `${t.listening.prep}: ${fmtClock(countdown)}`
      : phase === "play"
        ? `🔊 ${t.listening.play(play, plays)}${audioSrc ? "" : ` · ${line + 1}/${L.script.length}`}`
        : phase === "pause"
          ? `${t.listening.pause}: ${fmtClock(countdown)}`
          : phase === "after"
            ? `${t.listening.done} ${fmtClock(countdown)}`
            : phase === "done"
              ? t.listening.done
              : "";

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4" data-testid="listening-player">
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="auto" />}
      {!tts && !audioSrc && <p className="mb-2 text-sm text-bad">{t.listening.noTts}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {phase === "idle" && (
          <button type="button" className={btn.primary} onClick={run} disabled={!tts && !audioSrc} data-testid="start-audio">
            ▶ {t.listening.startAudio}
          </button>
        )}
        {status && (
          <span className="font-medium" role="status">
            {status}
          </span>
        )}
        {(phase === "prep" || phase === "pause" || phase === "after") && mode === "practice" && (
          <button type="button" className={btn.small} onClick={() => skip.current?.()}>
            ⏭ {t.listening.skipPrep}
          </button>
        )}
        {phase !== "idle" && phase !== "done" && mode === "practice" && (
          <button
            type="button"
            className={btn.small}
            onClick={() => {
              cancelled.current = true;
              stopSpeaking();
              audioRef.current?.pause();
              skip.current?.();
              setPhase("idle");
            }}
          >
            ■ {t.listening.stop}
          </button>
        )}
        {audioSrc && <span className="text-xs text-muted">🏛 {t.listening.officialAudio}</span>}
      </div>
    </div>
  );
}

export function Transcript({ task, highlight }: { task: ObjectiveTask; highlight: string[] }) {
  const L = task.listening;
  if (!L) return null;
  const ev = task.items.filter((i) => highlight.includes(i.id) && i.evidence).map((i) => ({ id: i.id, text: i.evidence! }));
  const name = (id: string) => L.speakers.find((s) => s.id === id)?.name ?? id;
  return (
    <details open className="rounded-xl border border-border bg-surface p-4" data-testid="transcript">
      <summary className="cursor-pointer font-semibold">{t.listening.transcript}</summary>
      <p className="mt-1 text-xs text-muted">{t.listening.transcriptHint}</p>
      <div className="mt-3 space-y-2 font-reading text-[16px] leading-relaxed">
        {L.script.map((l, i) => {
          const ranges = ev.map((e) => findLoose(l.text, e.text));
          const segs = segmentText(l.text, ranges);
          return (
            <p key={i}>
              <b className="mr-2 font-sans text-sm">{name(l.speaker)}:</b>
              {segs.map((s, j) =>
                s.mark === undefined ? (
                  <span key={j}>{s.text}</span>
                ) : (
                  <mark key={j}>
                    {s.text}
                    <sup className="ml-0.5 font-sans text-[10px] font-bold text-accent">{ev[s.mark]!.id}</sup>
                  </mark>
                ),
              )}
            </p>
          );
        })}
      </div>
    </details>
  );
}

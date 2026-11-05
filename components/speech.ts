"use client";

import { useEffect, useState } from "react";

/**
 * Browser speech helpers: text-to-speech for listening tasks and questions,
 * speech recognition for oral practice. Free, local Web Speech API – no
 * external service. Recognition works in Chrome / Edge.
 */

export type Gender = "female" | "male";

const FEMALE_HINTS = /female|woman|samantha|victoria|karen|moira|tessa|fiona|serena|kate|susan|zira|hazel|libby|sonia|jenny|aria|emma|amy|joanna|salli|kimberly|ivy|natasha|olivia|ava|allison|catherine|nicky|martha|maisie|google uk english female|google us english/i;
const MALE_HINTS = /\bmale\b|daniel|alex|fred|george|david|mark|ryan|guy|thomas|oliver|arthur|aaron|rishi|brian|matthew|joey|justin|russell|eric|tom|james|liam|william|google uk english male/i;

export function hasTts(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (!hasTts()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

export function voiceGender(v: SpeechSynthesisVoice): Gender | null {
  if (MALE_HINTS.test(v.name) && !/female/i.test(v.name)) return "male";
  if (FEMALE_HINTS.test(v.name)) return "female";
  return null;
}

/** Voices may load asynchronously (Chrome). */
export function voicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!hasTts()) return resolve([]);
    const v = englishVoices();
    if (v.length) return resolve(v);
    const done = () => resolve(englishVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

export function pickVoice(opts: { gender?: Gender; accent?: string; voiceURI?: string | null; avoid?: Set<string> }): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  if (!voices.length) return null;
  if (opts.voiceURI) {
    const v = voices.find((x) => x.voiceURI === opts.voiceURI);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (opts.gender && voiceGender(v) === opts.gender) s += 4;
    if (opts.gender && voiceGender(v) && voiceGender(v) !== opts.gender) s -= 4;
    if (opts.accent && v.lang.replace("_", "-").toLowerCase() === opts.accent.toLowerCase()) s += 2;
    else if (v.lang.toLowerCase().startsWith("en-gb")) s += 1;
    if (opts.avoid?.has(v.voiceURI)) s -= 3;
    if (v.localService) s += 0.5;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export type SpeakOpts = { rate?: number; pitch?: number; voiceURI?: string | null; gender?: Gender; accent?: string; voice?: SpeechSynthesisVoice | null };

/** Splits long text into chunks (Chrome cuts utterances after ~15 s). */
export function chunkText(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if ((cur + " " + s).trim().length > max && cur) {
      out.push(cur);
      cur = s;
    } else cur = (cur + " " + s).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!hasTts()) return resolve();
    const voice = opts.voice ?? pickVoice({ gender: opts.gender, accent: opts.accent, voiceURI: opts.voiceURI });
    const chunks = chunkText(text);
    let i = 0;
    const next = () => {
      if (i >= chunks.length) return resolve();
      const u = new SpeechSynthesisUtterance(chunks[i++]!);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = opts.accent ?? "en-GB";
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1;
      u.onend = next;
      u.onerror = next;
      window.speechSynthesis.speak(u);
    };
    next();
  });
}

export function stopSpeaking(): void {
  if (hasTts()) window.speechSynthesis.cancel();
}

/* ---------------- speech recognition ---------------- */

type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function hasAsr(): boolean {
  return recognitionCtor() !== null;
}

/**
 * Continuous dictation. Chrome stops after silence, so the recogniser is
 * restarted until stop() is called. onText gets the final text so far and the
 * current interim part.
 */
export function startDictation(opts: { lang?: string; onText: (finalText: string, interim: string) => void; onError?: (err: string) => void }) {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    opts.onError?.("unsupported");
    return { stop: () => {} };
  }
  let finalText = "";
  let active = true;
  let rec = new Ctor();
  const setup = () => {
    rec.lang = opts.lang ?? "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText = `${finalText} ${r[0].transcript}`.replace(/\s+/g, " ").trim();
        else interim += r[0].transcript;
      }
      opts.onText(finalText, interim);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      opts.onError?.(e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") active = false;
    };
    rec.onend = () => {
      if (active) {
        rec = new Ctor();
        setup();
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
  };
  setup();
  try {
    rec.start();
  } catch (e) {
    opts.onError?.((e as Error).message);
  }
  return {
    stop: () => {
      active = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Browser capability flags, read after mount so server and client render the same HTML. */
export function useSpeechSupport(): { tts: boolean; asr: boolean; ready: boolean } {
  const [s, setS] = useState({ tts: true, asr: true, ready: false });
  useEffect(() => {
    setS({ tts: hasTts(), asr: hasAsr(), ready: true });
  }, []);
  return s;
}

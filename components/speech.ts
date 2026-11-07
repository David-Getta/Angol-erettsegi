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

/** macOS effect voices (they sing, whisper or sound robotic) – never used for listening. */
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred)\b/i;
/** Voices that macOS lists although they may not be downloaded: speaking with them silently falls back to the system voice (often Hungarian). */
const MAYBE_MISSING = /premium|enhanced|siri/i;
/** Synthetic "Eloquence" voices: installed everywhere, but robotic. */
const ELOQUENCE = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
/** Voices that are installed by default and sound natural. */
const RELIABLE = /google|microsoft .*(natural|online)|\b(daniel|samantha|karen|moira|tessa|rishi|alex|hazel|george|susan|zira|david|libby|sonia|ryan|anna|helena|markus|yannick|petra|tünde|tunde)\b/i;

export function isNoveltyVoice(v: SpeechSynthesisVoice): boolean {
  return NOVELTY.test(v.name);
}

export function hasTts(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Usable voices of a language ("en", "en-GB", "de-DE", "hu" …), best first; English by default. Effect voices are left out. */
export function voicesFor(lang = "en"): SpeechSynthesisVoice[] {
  if (!hasTts()) return [];
  const prefix = lang.slice(0, 2).toLowerCase();
  const list = window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(prefix) && !isNoveltyVoice(v));
  return list.sort((a, b) => voiceQuality(b) - voiceQuality(a));
}

/** How safe and natural a voice is (independent of the speaker). */
export function voiceQuality(v: SpeechSynthesisVoice): number {
  let q = 0;
  // Chrome renders its Google voices itself, so they do not depend on the voices installed in the OS
  if (/^google\b/i.test(v.name)) q += 1.5;
  if (RELIABLE.test(v.name)) q += 3;
  if (MAYBE_MISSING.test(v.voiceURI) || MAYBE_MISSING.test(v.name)) q -= 3;
  if (ELOQUENCE.test(v.name)) q -= 2;
  if (v.localService) q += 0.5;
  return q;
}

/** Waits until the browser has loaded its voice list (Chrome loads it lazily). */
export function ensureVoices(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (!hasTts() || window.speechSynthesis.getVoices().length) return resolve();
    const done = () => resolve();
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return voicesFor("en");
}

export function voiceGender(v: SpeechSynthesisVoice): Gender | null {
  if (MALE_HINTS.test(v.name) && !/female/i.test(v.name)) return "male";
  if (FEMALE_HINTS.test(v.name)) return "female";
  return null;
}

/** Voices may load asynchronously (Chrome). */
export async function voicesReady(lang = "en", timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  await ensureVoices(timeoutMs);
  return voicesFor(lang);
}

export function pickVoice(opts: { gender?: Gender; accent?: string; voiceURI?: string | null; avoid?: Set<string> }): SpeechSynthesisVoice | null {
  // the accent ("en-GB", "hu-HU", "de-DE") decides the language of the voice
  const voices = voicesFor(opts.accent ?? "en");
  if (!voices.length) return null;
  if (opts.voiceURI) {
    const v = voices.find((x) => x.voiceURI === opts.voiceURI);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = voiceQuality(v);
    if (opts.gender && voiceGender(v) === opts.gender) s += 4;
    if (opts.gender && voiceGender(v) && voiceGender(v) !== opts.gender) s -= 4;
    if (opts.accent && v.lang.replace("_", "-").toLowerCase() === opts.accent.toLowerCase()) s += 2;
    else if (v.lang.toLowerCase().startsWith("en-gb")) s += 1;
    if (opts.avoid?.has(v.voiceURI)) s -= 3;
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

export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!hasTts()) return;
  // without a loaded voice list the browser would read with the system voice (on a Hungarian Mac: Hungarian)
  await ensureVoices();
  return new Promise((resolve) => {
    const voice = opts.voice ?? pickVoice({ gender: opts.gender, accent: opts.accent, voiceURI: opts.voiceURI });
    const chunks = chunkText(text);
    // a network voice (Google) fails offline: then the rest is read with the best local voice of the language
    let current = voice;
    const localFallback = () => voicesFor(opts.accent ?? voice?.lang ?? "en").find((x) => x.localService) ?? null;
    let i = 0;
    const say = (chunk: string, retried: boolean) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (current) {
        u.voice = current;
        u.lang = current.lang;
      } else u.lang = opts.accent ?? "en-GB";
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1;
      u.onend = next;
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (!retried && current && !current.localService && e.error !== "interrupted" && e.error !== "canceled") {
          current = localFallback();
          say(chunk, true);
        } else next();
      };
      window.speechSynthesis.speak(u);
    };
    const next = () => {
      if (i >= chunks.length) return resolve();
      say(chunks[i++]!, false);
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
  // Electron exposes the constructor but has no speech service behind it (every start ends in a
  // "network" error), so the desktop app counts as unsupported and the UI points to the browser.
  if (window.desktop) return null;
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

/** The voice the app will use for a language, read after mount (null = none installed for that language). */
export function useVoiceInfo(lang: string): { ready: boolean; voice: { name: string; lang: string } | null } {
  const [info, setInfo] = useState<{ ready: boolean; voice: { name: string; lang: string } | null }>({ ready: false, voice: null });
  useEffect(() => {
    let alive = true;
    void ensureVoices().then(() => {
      if (!alive) return;
      const v = pickVoice({ accent: lang });
      setInfo({ ready: true, voice: v ? { name: v.name, lang: v.lang } : null });
    });
    return () => {
      alive = false;
    };
  }, [lang]);
  return info;
}

/** Browser capability flags, read after mount so server and client render the same HTML. */
export function useSpeechSupport(): { tts: boolean; asr: boolean; ready: boolean } {
  const [s, setS] = useState({ tts: true, asr: true, ready: false });
  useEffect(() => {
    setS({ tts: hasTts(), asr: hasAsr(), ready: true });
  }, []);
  return s;
}

/* ---------------- own voice recording (local only) ---------------- */

export function hasRecorder(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Records the microphone into an in-memory blob URL so the student can listen
 * back to their own pronunciation. Nothing is uploaded or stored.
 */
export async function startAudioRecording(): Promise<{ stop: () => Promise<string | null> } | null> {
  if (!hasRecorder()) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.start();
    return {
      stop: () =>
        new Promise((resolve) => {
          rec.onstop = () => {
            stream.getTracks().forEach((tr) => tr.stop());
            resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" })) : null);
          };
          if (rec.state !== "inactive") rec.stop();
          else resolve(null);
        }),
    };
  } catch {
    return null;
  }
}

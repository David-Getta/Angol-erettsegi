"use client";

import { useState } from "react";
import { speak, stopSpeaking, useSpeechSupport } from "@/components/speech";
import { btn } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

/** Reads the candidate's part of a sample answer aloud (browser TTS) to compare with your own recording. */
export function SpeakSampleButton({ text }: { text: string }) {
  const { tts } = useSpeechSupport();
  const [playing, setPlaying] = useState(false);
  if (!tts) return null;
  return (
    <button
      type="button"
      className={btn.small}
      onClick={async () => {
        if (playing) {
          stopSpeaking();
          setPlaying(false);
          return;
        }
        setPlaying(true);
        await speak(text, { rate: 0.95, accent: "en-GB" });
        setPlaying(false);
      }}
    >
      {playing ? t.voice.stopSample : t.voice.listenSample}
    </button>
  );
}

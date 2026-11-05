import { afterEach, describe, expect, it } from "vitest";
import { pickVoice, voicesFor } from "@/components/speech";

type V = { name: string; lang: string; voiceURI: string; localService: boolean; default: boolean };
const v = (name: string, lang: string, uri = `com.apple.voice.compact.${lang}.${name}`, localService = true): V => ({ name, lang, voiceURI: uri, localService, default: false });

/** A voice list like Chrome on a Hungarian macOS: the system voice is Hungarian, plus effect and not-downloaded premium voices. */
const MAC: V[] = [
  { ...v("Tünde", "hu-HU"), default: true },
  v("Albert", "en-US"),
  v("Bad News", "en-US"),
  v("Fred", "en-US"),
  v("Zarvox", "en-US"),
  v("Serena (Premium)", "en-GB", "com.apple.voice.premium.en-GB.Serena"),
  v("Kate (Enhanced)", "en-GB", "com.apple.voice.enhanced.en-GB.Kate"),
  v("Eddy (English (UK))", "en-GB", "com.apple.eloquence.en-GB.Eddy"),
  v("Daniel", "en-GB"),
  v("Samantha", "en-US"),
  v("Karen", "en-AU"),
  v("Anna", "de-DE"),
];
const GOOGLE: V[] = [v("Google UK English Female", "en-GB", "Google UK English Female", false), v("Google UK English Male", "en-GB", "Google UK English Male", false)];

function install(list: V[]) {
  (globalThis as unknown as { window: unknown }).window = { speechSynthesis: { getVoices: () => list } };
}
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("voice choice for listening", () => {
  it("never picks a Hungarian, effect or possibly missing premium voice for English", () => {
    install(MAC);
    for (const gender of ["female", "male", undefined] as const) {
      const p = pickVoice({ gender, accent: "en-GB" })!;
      expect(p.lang.startsWith("en"), `${gender}: ${p.name}`).toBe(true);
      expect(p.name).not.toMatch(/Tünde|Albert|Bad News|Fred|Zarvox|Premium|Enhanced/);
    }
    expect(pickVoice({ gender: "male", accent: "en-GB" })!.name).toBe("Daniel");
    expect(["Samantha", "Karen"]).toContain(pickVoice({ gender: "female", accent: "en-GB" })!.name);
    expect(voicesFor("en").map((x) => x.name)).not.toContain("Albert");
  });

  it("prefers the Google voices in Chrome and honours an explicit choice", () => {
    install([...MAC, ...GOOGLE]);
    expect(pickVoice({ gender: "female", accent: "en-GB" })!.name).toBe("Google UK English Female");
    expect(pickVoice({ gender: "male", accent: "en-GB" })!.name).toBe("Google UK English Male");
    expect(pickVoice({ gender: "female", accent: "en-GB", voiceURI: "com.apple.voice.premium.en-GB.Serena" })!.name).toBe("Serena (Premium)");
  });

  it("uses the subject's language: German for German, nothing English for Hungarian", () => {
    install(MAC);
    expect(pickVoice({ accent: "de-DE" })!.name).toBe("Anna");
    expect(pickVoice({ accent: "hu-HU" })!.name).toBe("Tünde");
    install(MAC.filter((x) => !x.lang.startsWith("de")));
    expect(pickVoice({ accent: "de-DE" })).toBeNull();
  });
});

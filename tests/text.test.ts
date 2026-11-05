import { describe, expect, it } from "vitest";
import { quotedPhrases } from "@/lib/content/text";

describe("quotedPhrases", () => {
  it("collects English phrases quoted in Hungarian notes and skips Hungarian or elided quotes", () => {
    const notes = [
      "Érdemes megtanulni: „I am writing to ask about”, „as far as I know.”, „cost … a fortune”.",
      "A „Dear Sir or Madam” megszólítás után „Yours faithfully” jár; a „hivatalos” szó itt magyar.",
      "Ismétlés: „as far as I know”.",
    ];
    const text = "Dear Sir or Madam, I am writing to ask about the course. As far as I know, it starts in May. Yours faithfully, Anna";
    expect(quotedPhrases(notes, text)).toEqual(["I am writing to ask about", "as far as I know", "Dear Sir or Madam", "Yours faithfully"]);
    // without the source text Hungarian words without accents cannot be told apart
    expect(quotedPhrases(notes)).toContain("hivatalos");
  });
});

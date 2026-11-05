import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { phraseBank } from "@/lib/phrases";
import { addWord } from "@/lib/vocab/cards";

describe("Kifejezéstár", () => {
  beforeAll(() => {
    seedContent();
  });

  it("groups the useful phrases of writing and speaking cards by type without duplicates", () => {
    const groups = phraseBank("emelt");
    expect(groups.some((g) => g.section === "writing")).toBe(true);
    expect(groups.some((g) => g.section === "speaking" && g.type === "debate")).toBe(true);
    for (const g of groups) {
      const keys = g.phrases.map((p) => p.en.toLowerCase().trim());
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("marks phrases that are already flashcards", () => {
    const phrase = phraseBank("emelt")[0]!.phrases[0]!;
    expect(phrase.inCards).toBe(false);
    addWord({ term: phrase.en, meaning: phrase.hu, sourceType: "phrase" });
    const again = phraseBank("emelt")[0]!.phrases.find((p) => p.en === phrase.en)!;
    expect(again.inCards).toBe(true);
  });
});

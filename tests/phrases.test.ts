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

  it("adds the phrases of the writing and speaking guides to their type's group", async () => {
    const { loadAllContent } = await import("@/lib/content/load");
    const guide = loadAllContent()
      .items.map((i) => i.content!)
      .find((c) => c.section === "guide" && c.type === "writing" && c.target === "formal-email");
    if (!guide || guide.section !== "guide") return; // guides are optional content
    const group = phraseBank("emelt").find((g) => g.section === "writing" && g.type === "formal-email")!;
    const ens = new Set(group.phrases.map((p) => p.en.toLowerCase()));
    expect(guide.phrases.some((p) => ens.has(p.en.toLowerCase()))).toBe(true);
  });

  it("marks phrases that are already flashcards", () => {
    const phrase = phraseBank("emelt")[0]!.phrases[0]!;
    expect(phrase.inCards).toBe(false);
    addWord({ term: phrase.en, meaning: phrase.hu, sourceType: "phrase" });
    const again = phraseBank("emelt")[0]!.phrases.find((p) => p.en === phrase.en)!;
    expect(again.inCards).toBe(true);
  });
});

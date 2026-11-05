import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { compareWords, dictationSentences } from "@/lib/dictation";
import { getTaskRow } from "@/lib/tasks";

describe("dictation", () => {
  beforeAll(() => {
    seedContent();
  });

  it("picks sentences of the right length from unreserved listening scripts", () => {
    const s = dictationSentences("kozep", 10, 42);
    expect(s.length).toBe(10);
    for (const x of s) {
      expect(getTaskRow(x.taskId)?.reservedFor ?? null).toBeNull();
      const n = x.text.split(/\s+/).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(15);
    }
    expect(dictationSentences("kozep", 10, 42).map((x) => x.key)).toEqual(s.map((x) => x.key));
  });

  it("compares word by word, ignoring case and punctuation", () => {
    const r = compareWords("The first thirty minutes are free.", "the first 30 minutes is free");
    expect(r.total).toBe(6);
    // "30" for "thirty" is fine; "is" for "are" is not
    expect(r.correct).toBe(5);
    expect(r.tokens.filter((t) => t.status === "wrong").map((t) => [t.word, t.typed])).toEqual([["are", "is"]]);
    const m = compareWords("I have lived here since 2020.", "I lived here since 2020");
    expect(m.tokens.find((t) => t.status === "missing")?.word).toBe("have");
    const e = compareWords("We went home.", "We went back home.");
    expect(e.tokens.find((t) => t.status === "extra")?.word).toBe("back");
    expect(e.correct).toBe(3);
  });
});

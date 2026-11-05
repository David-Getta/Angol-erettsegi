import { describe, expect, it } from "vitest";
import { checkItem, levenshtein, normalizeAnswer, scoreTask } from "@/lib/scoring/check";
import type { Item } from "@/lib/content/schema";

const text = (answer: string[], extra: Partial<Item> = {}): Item =>
  ({ id: "1", kind: "text", answer, category: "tense", explanation: "x", points: 1, ...extra }) as Item;

describe("normalizeAnswer", () => {
  it("ignores case, extra spaces and typographic apostrophes", () => {
    expect(normalizeAnswer("  Has   BEEN ")).toBe("has been");
    expect(normalizeAnswer("don’t")).toBe("don't");
    expect(normalizeAnswer("well-known")).toBe(normalizeAnswer("well - known"));
  });
  it("drops trailing sentence punctuation", () => {
    expect(normalizeAnswer("in the morning.")).toBe("in the morning");
  });
  it("maps correct-line markers", () => {
    for (const m of ["✓", "ok", "OK", "correct", "helyes", "✔"]) expect(normalizeAnswer(m)).toBe("✓");
  });
});

describe("checkItem", () => {
  const task = { options: [] };
  it("accepts every listed alternative", () => {
    const it1 = text(["although", "though"]);
    expect(checkItem(task, it1, "Though").correct).toBe(true);
    expect(checkItem(task, it1, " although ").correct).toBe(true);
    expect(checkItem(task, it1, "despite").correct).toBe(false);
  });
  it("flags a near miss but does not accept it by default", () => {
    const r = checkItem(task, text(["necessary"]), "neccessary");
    expect(r.correct).toBe(false);
    expect(r.near).toBe(true);
  });
  it("accepts a near miss when configured", () => {
    const r = checkItem(task, text(["necessary"]), "neccessary", { acceptNearMiss: true });
    expect(r.correct).toBe(true);
  });
  it("does not treat short wrong words as typos", () => {
    const r = checkItem(task, text(["of"]), "on");
    expect(r.near).toBe(false);
  });
  it("empty answer is wrong, not near", () => {
    const r = checkItem(task, text(["had"]), "");
    expect(r).toMatchObject({ correct: false, near: false, points: 0 });
  });
  it("checks choice and match keys case-insensitively", () => {
    const choice = { id: "2", kind: "choice", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], answer: "B", category: "detail", explanation: "x", points: 1 } as Item;
    expect(checkItem(task, choice, "b").correct).toBe(true);
    expect(checkItem(task, choice, "A").expectedLabel).toBe("B – b");
  });
  it("error-correction lines accept the tick marker", () => {
    const r = checkItem(task, text(["✓"]), "ok");
    expect(r.correct).toBe(true);
  });
});

describe("scoreTask", () => {
  it("sums points over items", () => {
    const items = [text(["a"], { id: "1" }), text(["b"], { id: "2", points: 2 }), text(["c"], { id: "3" })];
    const r = scoreTask({ options: [], items }, { "1": "a", "2": "B", "3": "x" });
    expect(r.score).toBe(3);
    expect(r.maxScore).toBe(4);
    expect(r.items.map((i) => i.correct)).toEqual([true, true, false]);
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("numbers written in words", () => {
  it("turns number words into digits", async () => {
    const { numberWordsToDigits } = await import("@/lib/scoring/check");
    expect(numberWordsToDigits("two hundred and forty")).toBe("240");
    expect(numberWordsToDigits("a hundred and fifty")).toBe("150");
    expect(numberWordsToDigits("nine people")).toBe("9 people");
    expect(numberWordsToDigits("twenty-five euros")).toBe("25 euros");
    expect(numberWordsToDigits("two thousand and twenty")).toBe("2020");
    expect(numberWordsToDigits("bread and butter")).toBe("bread and butter");
    expect(numberWordsToDigits("a lot of time")).toBe("a lot of time");
    expect(numberWordsToDigits("one-way ticket")).toBe("one-way ticket");
  });

  it("accepts a number in words when the key has digits and vice versa", async () => {
    const { checkItem } = await import("@/lib/scoring/check");
    const item = { id: "1", kind: "text" as const, answer: ["240"], category: "detail", explanation: "x", points: 1 };
    expect(checkItem({}, item, "two hundred and forty").correct).toBe(true);
    expect(checkItem({}, { ...item, answer: ["nine people"] }, "9 people").correct).toBe(true);
    expect(checkItem({}, item, "241").correct).toBe(false);
  });
});

describe("thousands separators", () => {
  it("treats 5 000, 5.000, 5,000 and five thousand as 5000, but keeps decimals and times", async () => {
    const { normalizeForCheck } = await import("@/lib/scoring/check");
    for (const x of ["5000", "5 000", "5.000", "5,000", "five thousand", "about 5 000"]) expect(normalizeForCheck(x).replace("about ", "")).toBe("5000");
    expect(normalizeForCheck("1,250,000")).toBe("1250000");
    expect(normalizeForCheck("7.30")).toBe("7.30");
    expect(normalizeForCheck("2.5 km")).toBe("2.5 km");
  });
});

describe("Hungarian number notation (non-language subjects)", () => {
  it("treats a decimal comma and a decimal dot as the same, and only spaces as thousands separators", async () => {
    const { normalizeForCheck, checkItem } = await import("@/lib/scoring/check");
    const hu = { decimalComma: true };
    expect(normalizeForCheck("0,5", hu)).toBe(normalizeForCheck("0.5", hu));
    expect(normalizeForCheck("3,14", hu)).toBe("3.14");
    expect(normalizeForCheck("1,125", hu)).toBe("1.125");
    expect(normalizeForCheck("1,125", hu)).not.toBe(normalizeForCheck("1125", hu));
    expect(normalizeForCheck("1 000 000", hu)).toBe("1000000");
    const item = { id: "1", kind: "text" as const, answer: ["2,5"], category: "szamolasi-hiba", explanation: "x", points: 1 };
    expect(checkItem({ options: undefined }, item, "2.5", hu).correct).toBe(true);
    expect(checkItem({ options: undefined }, item, "25", hu).correct).toBe(false);
    // spacing around numbers and symbols does not matter, words keep their spaces
    expect(normalizeForCheck("(4; 6)", hu)).toBe(normalizeForCheck("(4;6)", hu));
    expect(normalizeForCheck("x = 3", hu)).toBe(normalizeForCheck("x=3", hu));
    expect(normalizeForCheck("20 π", hu)).toBe(normalizeForCheck("20π", hu));
    expect(normalizeForCheck("Kossuth Lajos", hu)).toBe("kossuth lajos");
    // English keeps the comma as a thousands separator
    expect(normalizeForCheck("5,000")).toBe("5000");
  });
});

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

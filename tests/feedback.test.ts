import { describe, expect, it } from "vitest";
import { parseFeedbackText, extractJson } from "@/lib/exchange/schema";

const good = {
  schemaVersion: 1,
  submissionId: "w-1",
  kind: "writing",
  rubricId: "writing-emelt-task2",
  criteria: [
    { id: "a", score: 3, max: 5, justification: "ok" },
    { id: "b", score: 4, max: 5, justification: "ok" },
  ],
  totalScore: 7,
  maxScore: 10,
  corrections: [{ original: "I goed", corrected: "I went", category: "verb-form", explanation: "A go rendhagyó ige, múlt ideje went." }],
  priorities: ["egy", "kettő", "három"],
  improvedVersion: "Better text.",
  summary: "Összegzés.",
};

describe("feedback parsing", () => {
  it("accepts valid JSON wrapped in a code fence and prose", () => {
    const r = parseFeedbackText("Itt a javítás:\n```json\n" + JSON.stringify(good) + "\n```\nSok sikert!");
    expect(r.ok).toBe(true);
  });
  it("reports missing fields in Hungarian with the path", () => {
    const { summary: _s, ...rest } = good;
    const r = parseFeedbackText(JSON.stringify(rest));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/summary \(összefoglaló\): hiányzik/);
  });
  it("checks that the total equals the sum of the criteria", () => {
    const r = parseFeedbackText(JSON.stringify({ ...good, totalScore: 9 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/nem egyezik/);
  });
  it("requires exactly three priorities", () => {
    const r = parseFeedbackText(JSON.stringify({ ...good, priorities: ["a"] }));
    expect(r.ok).toBe(false);
  });
  it("rejects a score above the maximum", () => {
    const r = parseFeedbackText(JSON.stringify({ ...good, criteria: [{ id: "a", score: 6, max: 5, justification: "x" }, good.criteria[1]], totalScore: 10 }));
    expect(r.ok).toBe(false);
  });
  it("explains broken JSON", () => {
    const r = parseFeedbackText('{ "schemaVersion": 1, ');
    expect(r.ok).toBe(false);
  });
  it("extracts the outermost object", () => {
    expect(extractJson('blah {"a": {"b": 1}} blah')).toBe('{"a": {"b": 1}}');
    expect(extractJson("nincs json")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { newFsrsState, review, previewIntervals } from "@/lib/vocab/fsrs";
import { clozeFor } from "@/lib/vocab/cards";

describe("FSRS scheduling", () => {
  it("good answers push the due date further out", () => {
    let state = newFsrsState(new Date("2026-01-01T10:00:00Z"));
    let now = new Date("2026-01-01T10:00:00Z");
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = review(state, 3, now);
      gaps.push(r.due.getTime() - now.getTime());
      state = r.state;
      now = r.due;
    }
    expect(gaps[3]!).toBeGreaterThan(gaps[1]!);
  });
  it("'again' schedules sooner than 'easy'", () => {
    const s = newFsrsState(new Date("2026-01-01T10:00:00Z"));
    const now = new Date("2026-01-01T10:00:00Z");
    expect(review(s, 1, now).due.getTime()).toBeLessThan(review(s, 4, now).due.getTime());
  });
  it("previews intervals for all four ratings", () => {
    const p = previewIntervals(newFsrsState());
    expect(Object.keys(p)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("cloze cards", () => {
  it("blanks out the term, tolerating inflection", () => {
    expect(clozeFor("She has already made a decision.", "make a decision")).toMatch(/She has already _+\.?/);
    expect(clozeFor("The children were playing outside.", "play")).toContain("_");
    expect(clozeFor("Nothing here.", "decision")).toBeNull();
  });
});

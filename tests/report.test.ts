import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { progressReport } from "@/lib/report";
import { levelStructure } from "@/lib/exam/config";

describe("progress report", () => {
  beforeAll(() => {
    seedContent();
  });

  it("works on an empty database and covers every exam part", () => {
    const r = progressReport();
    expect(r.estimates).toHaveLength(levelStructure(r.level).parts.length);
    expect(r.estimatedTotal.max).toBe(levelStructure(r.level).totalPoints);
    expect(r.lastMock).toBeNull();
    expect(r.writing).toEqual([]);
    expect(r.practice.minutes30).toBe(0);
  });
});

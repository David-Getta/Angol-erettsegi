import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { topicOverviews } from "@/lib/topics";
import { examConfig } from "@/lib/exam/config";

describe("topic overviews", () => {
  beforeAll(() => {
    seedContent();
  });

  it("covers every topic, hides reserved mock/diagnostic tasks and finds the deck", () => {
    const o = topicOverviews("emelt");
    expect(o).toHaveLength(examConfig.topics().topics.length);
    const all = o.flatMap((x) => Object.values(x.tasks).flat());
    expect(all.length).toBeGreaterThan(50);
    expect(all.every((t) => !t.reservedFor)).toBe(true);
    expect(o.filter((x) => x.deck).length).toBeGreaterThanOrEqual(8);
    for (const x of o) for (const list of Object.values(x.tasks)) expect(list.every((t) => t.topic === x.topic.id)).toBe(true);
  });
});

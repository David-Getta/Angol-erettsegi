import { describe, expect, it } from "vitest";
import { startupSeed } from "@/lib/startup";
import { closeDb, getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { GET } from "@/app/api/health/route";

describe("server start-up (desktop app)", () => {
  it("seeds the content bank into a fresh database and is idempotent", async () => {
    const lines: string[] = [];
    const first = await startupSeed((m) => lines.push(m));
    expect(first.seed.inserted).toBeGreaterThan(100);
    expect(first.seed.failed).toEqual([]);
    expect(lines.some((l) => l.startsWith("Tartalom betöltve"))).toBe(true);
    const again = await startupSeed(() => {});
    expect(again.seed.inserted).toBe(0);
    expect(again.seed.updated).toBe(0);
    expect(again.seed.unchanged).toBe(first.seed.inserted);
    const count = getDb().select().from(s.tasks).all().length;
    expect(count).toBe(first.seed.inserted);
    closeDb();
  });

  it("answers the readiness probe", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; pid: number };
    expect(body.ok).toBe(true);
    expect(body.pid).toBe(process.pid);
  });
});

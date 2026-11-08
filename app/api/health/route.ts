import { NextResponse } from "next/server";
import { getStartupStatus } from "@/lib/startup";

export const dynamic = "force-dynamic";

/** Readiness probe for the desktop shell (it waits for this before opening the window) with the start-up seed's outcome. */
export function GET() {
  const seed = getStartupStatus();
  return NextResponse.json({
    ok: true,
    version: process.env.APP_VERSION ?? null,
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    seed: seed ? { ok: seed.ok, error: seed.error ?? null, at: seed.at } : null,
  });
}

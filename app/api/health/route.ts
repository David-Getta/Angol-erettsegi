import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Readiness probe for the desktop shell (it waits for this before opening the window). */
export function GET() {
  return NextResponse.json({
    ok: true,
    version: process.env.APP_VERSION ?? null,
    pid: process.pid,
    uptime: Math.round(process.uptime()),
  });
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e tests run a second dev server with its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The desktop app (scripts/desktop/build.ts) ships the self-contained standalone server.
  output: process.env.DESKTOP_BUILD === "1" ? "standalone" : undefined,
  // better-sqlite3 is a native module and must stay out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Allow opening the dev server from a phone on the local network (npm run dev:lan).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  devIndicators: false,
  // CLAUDE.md holds the project rules; do not let `next dev` write AGENTS.md.
  agentRules: false,
};

export default nextConfig;

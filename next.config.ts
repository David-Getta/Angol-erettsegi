import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and must stay out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Allow opening the dev server from a phone on the local network (npm run dev:lan).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  devIndicators: false,
  // CLAUDE.md holds the project rules; do not let `next dev` write AGENTS.md.
  agentRules: false,
};

export default nextConfig;

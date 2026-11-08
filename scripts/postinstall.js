// Runs after `npm install`: switches off Next.js anonymous telemetry so the
// student never sees the notice or sends usage data. Never fails the install.
const { spawnSync } = require("node:child_process");
let bin;
try {
  bin = require.resolve("next/dist/bin/next");
} catch {
  process.exit(0);
}
spawnSync(process.execPath, [bin, "telemetry", "disable"], { stdio: "ignore" });
process.exit(0);

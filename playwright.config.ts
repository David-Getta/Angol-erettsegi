import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a separate dev server (port 3210) with its own
 * database and exchange folder in a temp directory, so they never touch
 * data/app.db or exchange/.
 */
const PORT = 3210;
if (!process.env.E2E_TMP) {
  process.env.E2E_TMP = fs.mkdtempSync(path.join(os.tmpdir(), "angol-e2e-"));
}
const tmp = process.env.E2E_TMP;
const env = {
  APP_DATA_DIR: path.join(tmp, "data"),
  APP_EXCHANGE_DIR: path.join(tmp, "exchange"),
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } }],
  webServer: {
    command: `npx tsx scripts/seed.ts --quiet && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});

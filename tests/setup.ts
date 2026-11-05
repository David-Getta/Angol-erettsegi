import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every test worker gets its own database and exchange folder; content/ and config/ are the real ones.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "angol-test-"));
process.env.APP_DATA_DIR = path.join(dir, "data");
process.env.APP_DB_PATH = path.join(dir, "data", "app.db");
process.env.APP_EXCHANGE_DIR = path.join(dir, "exchange");
fs.mkdirSync(process.env.APP_DATA_DIR, { recursive: true });

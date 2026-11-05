import path from "node:path";

/**
 * All filesystem locations used by the app and the scripts.
 * Every path can be overridden with an environment variable, which the tests use
 * to work on temporary copies instead of the real data.
 */
export const ROOT = process.env.APP_ROOT ?? process.cwd();

export const paths = {
  root: ROOT,
  config: process.env.APP_CONFIG_DIR ?? path.join(ROOT, "config"),
  content: process.env.APP_CONTENT_DIR ?? path.join(ROOT, "content"),
  exchange: process.env.APP_EXCHANGE_DIR ?? path.join(ROOT, "exchange"),
  data: process.env.APP_DATA_DIR ?? path.join(ROOT, "data"),
  migrations: path.join(ROOT, "drizzle"),
  claudeCommands: path.join(ROOT, ".claude", "commands"),
  get db() {
    return process.env.APP_DB_PATH ?? path.join(this.data, "app.db");
  },
  get inbox() {
    return path.join(this.exchange, "inbox");
  },
  get outbox() {
    return path.join(this.exchange, "outbox");
  },
  get archive() {
    return path.join(this.exchange, "archive");
  },
  get official() {
    return path.join(this.data, "official");
  },
  get backups() {
    return path.join(this.data, "backups");
  },
};

/** Path relative to the project root, with forward slashes (for display and JSON). */
export function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

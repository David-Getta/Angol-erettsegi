import fs from "node:fs";
import path from "node:path";
import { paths, rel } from "@/lib/paths";
import { SubmissionFileSchema, type SubmissionFile } from "./schema";

/** Filesystem side of the grading exchange (exchange/inbox, outbox, archive). */

export function ensureExchangeDirs(): void {
  for (const d of [paths.inbox, paths.outbox, paths.archive, paths.official, paths.backups]) fs.mkdirSync(d, { recursive: true });
}

const jsonFiles = (dir: string) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

export function writeInboxFile(sub: SubmissionFile): string {
  ensureExchangeDirs();
  const parsed = SubmissionFileSchema.parse(sub);
  const file = path.join(paths.inbox, `${parsed.id}.json`);
  fs.writeFileSync(file, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  return rel(file);
}

export function listInbox(): string[] {
  return jsonFiles(paths.inbox).map((f) => f.replace(/\.json$/, ""));
}

export function listOutbox(): string[] {
  return jsonFiles(paths.outbox).map((f) => f.replace(/\.json$/, ""));
}

/** Inbox submissions that have no feedback in the outbox yet. */
export function pendingInbox(): string[] {
  const out = new Set(listOutbox());
  return listInbox().filter((id) => !out.has(id));
}

export function readOutboxText(id: string): string {
  return fs.readFileSync(path.join(paths.outbox, `${id}.json`), "utf8");
}

export function readInboxFile(id: string): SubmissionFile | null {
  const file = path.join(paths.inbox, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  const parsed = SubmissionFileSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  return parsed.success ? parsed.data : null;
}

/** Moves the inbox submission and its feedback (if any) into exchange/archive. */
export function archiveExchange(id: string, feedbackJson?: string): void {
  ensureExchangeDirs();
  const inbox = path.join(paths.inbox, `${id}.json`);
  const outbox = path.join(paths.outbox, `${id}.json`);
  if (fs.existsSync(inbox)) fs.renameSync(inbox, path.join(paths.archive, `${id}.submission.json`));
  if (fs.existsSync(outbox)) fs.renameSync(outbox, path.join(paths.archive, `${id}.feedback.json`));
  else if (feedbackJson) fs.writeFileSync(path.join(paths.archive, `${id}.feedback.json`), feedbackJson, "utf8");
}

export function removeInboxFile(id: string): void {
  const inbox = path.join(paths.inbox, `${id}.json`);
  if (fs.existsSync(inbox)) fs.unlinkSync(inbox);
}

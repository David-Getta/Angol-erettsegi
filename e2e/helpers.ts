import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export const exchangeDir = () => process.env.APP_EXCHANGE_DIR!;

export function inboxIds(): string[] {
  const dir = path.join(exchangeDir(), "inbox");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : [];
}

export function readInbox(id: string) {
  return JSON.parse(fs.readFileSync(path.join(exchangeDir(), "inbox", `${id}.json`), "utf8"));
}

/** What /javitas would write: a feedback file that follows the template in the inbox instructions. */
export function feedbackFromInbox(id: string, gradedBy = "claude-code") {
  const sub = readInbox(id);
  const json = sub.instructions.slice(sub.instructions.lastIndexOf("{\n  \"schemaVersion\""));
  const tpl = JSON.parse(json);
  const criteria = tpl.criteria.map((c: { id: string; max: number }) => ({ id: c.id, score: Math.max(0, c.max - 1), max: c.max, justification: "Szigorú indoklás." }));
  const firstWords = sub.text.split(/\s+/).slice(0, 2).join(" ");
  return {
    ...tpl,
    gradedBy,
    criteria,
    totalScore: criteria.reduce((n: number, c: { score: number }) => n + c.score, 0),
    maxScore: criteria.reduce((n: number, c: { max: number }) => n + c.max, 0),
    taskPoints: tpl.taskPoints.map((p: { id: string }) => ({ id: p.id, status: "covered", comment: "Kifejtve." })),
    corrections: [{ original: firstWords, corrected: firstWords, category: "word-choice", explanation: "Teszt: a helyes forma és az oka." }],
    priorities: ["Igeidők", "Kötőszavak", "Szókincs"],
    improvedVersion: sub.text,
    usefulPhrases: [{ en: "all things considered", hu: "mindent összevetve" }],
    summary: "Összegzés a teszthez.",
  };
}

export function writeOutbox(id: string, data: unknown) {
  const dir = path.join(exchangeDir(), "outbox");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2));
}

export async function acceptDialogs(page: Page) {
  page.on("dialog", (d) => d.accept());
}

export const SAMPLE_TEXT = `Hello everyone,

In Hungary most students go to university straight after secondary school, but some of them take a gap year. I believe a gap year can have many advantages. For example, you can gain work experience, travel abroad and find out what you really want to study.

However, there are also risks. Some young people lose the habit of studying and never go back to school. Others spend a lot of money and come home with nothing useful.

All things considered, I would take a gap year, but only with a clear plan. I would like to work in a hostel in Ireland to improve my English and save money for university.

Best wishes,
Anna`;

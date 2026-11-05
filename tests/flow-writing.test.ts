import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { seedContent } from "@/lib/content/seed";
import { applyPastedFeedback, createSubmission, getSubmission, importOutbox, rubricRefFor, versionsOf } from "@/lib/submissions";
import { listInbox, pendingInbox, readInboxFile } from "@/lib/exchange/files";
import { recentErrors, categoryStats } from "@/lib/errors/log";
import { paths } from "@/lib/paths";

const TASK = "wr-emelt-gap-year-forum";
const TEXT = `Hello everyone,
In Hungary most students goes to university straight after school. I think a gap year have many advantages, for example you can gain work experience.
However, there are risks too. All things considered, I would take a gap year.`;

function feedbackFor(id: string, taskNumber: number, total?: number) {
  const ref = rubricRefFor("writing", "emelt", taskNumber);
  const criteria = ref.criteria.map((c, i) => ({ id: c.id, score: Math.min(c.max, i + 1), max: c.max, justification: "Indoklás." }));
  return {
    schemaVersion: 1,
    submissionId: id,
    kind: "writing",
    gradedBy: "claude-code",
    rubricId: ref.id,
    criteria,
    totalScore: total ?? criteria.reduce((s, c) => s + c.score, 0),
    maxScore: criteria.reduce((s, c) => s + c.max, 0),
    taskPoints: ["p1", "p2", "p3", "p4"].map((p) => ({ id: p, status: "covered", comment: "Rendben." })),
    corrections: [
      { original: "students goes", corrected: "students go", category: "agreement", explanation: "Többes számú alany után az ige nem kap -s végződést: students go." },
      { original: "a gap year have", corrected: "a gap year has", category: "agreement", explanation: "Egyes számú alany (a gap year) után harmadik személyű alak kell: has." },
    ],
    priorities: ["Egyeztetés", "Kötőszavak", "Szószám"],
    improvedVersion: "Hello everyone, ...",
    usefulPhrases: [{ en: "to gain work experience", hu: "munkatapasztalatot szerezni" }],
    summary: "Jó kezdet.",
  };
}

describe("writing flow: submit → /javitas (outbox) → import → rewrite → paste", () => {
  beforeAll(() => {
    seedContent();
  });

  it("goes through the whole cycle", () => {
    const sub = createSubmission({ kind: "writing", taskId: TASK, text: TEXT, mode: "practice", durationSec: 600 });
    expect(sub.status).toBe("pending");
    expect(listInbox()).toContain(sub.id);
    const inbox = readInboxFile(sub.id)!;
    expect(inbox.rubric.id).toBe("writing-emelt-task2");
    expect(inbox.instructions).toContain(TEXT.split("\n")[1]);
    expect(inbox.instructions).toContain('"submissionId": "' + sub.id + '"');

    // /javitas writes the outbox file
    fs.writeFileSync(path.join(paths.outbox, `${sub.id}.json`), JSON.stringify(feedbackFor(sub.id, 2)));
    const rep = importOutbox();
    expect(rep.failed).toEqual([]);
    expect(rep.imported).toEqual([sub.id]);
    const graded = getSubmission(sub.id)!;
    expect(graded.status).toBe("graded");
    expect(graded.score).toBeGreaterThan(0);
    expect(pendingInbox()).not.toContain(sub.id);
    expect(fs.existsSync(path.join(paths.archive, `${sub.id}.submission.json`))).toBe(true);

    // error log got both corrections with the correct form and the reason
    const errs = recentErrors(10).filter((e) => e.sourceId === sub.id);
    expect(errs).toHaveLength(2);
    expect(errs.every((e) => e.corrected && e.explanation)).toBe(true);
    expect(categoryStats().find((c) => c.category === "agreement")?.total).toBe(2);

    // re-import is idempotent (no duplicate errors)
    fs.writeFileSync(path.join(paths.outbox, `${sub.id}.json`), JSON.stringify(feedbackFor(sub.id, 2)));
    importOutbox();
    expect(recentErrors(10).filter((e) => e.sourceId === sub.id)).toHaveLength(2);

    // rewrite round
    const v2 = createSubmission({ kind: "writing", taskId: TASK, text: TEXT.replace("goes", "go"), mode: "practice", durationSec: 300, parentId: sub.id });
    expect(v2.version).toBe(2);
    expect(v2.rootId).toBe(sub.id);
    expect(readInboxFile(v2.id)!.previousVersion?.id).toBe(sub.id);
    expect(versionsOf(sub.id).map((v) => v.version)).toEqual([1, 2]);

    // paste path (Claude app): wrong submission id in the pasted JSON is patched
    const pasted = "Itt a javítás:\n```json\n" + JSON.stringify({ ...feedbackFor("valami-mas", 2), gradedBy: "claude-app" }) + "\n```";
    const r = applyPastedFeedback(v2.id, pasted);
    expect(r.ok).toBe(true);
    expect(getSubmission(v2.id)!.gradedBy).toBe("claude-app");
  });

  it("rejects feedback with the wrong rubric criteria", () => {
    const sub = createSubmission({ kind: "writing", taskId: TASK, text: TEXT, mode: "practice", durationSec: 60 });
    const fb = feedbackFor(sub.id, 2);
    fb.criteria[0]!.id = "valami";
    const r = applyPastedFeedback(sub.id, JSON.stringify(fb));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/szempont/);
  });
});

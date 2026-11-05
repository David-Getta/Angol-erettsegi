import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubmission, versionsOf, rubricRefFor, gradingPromptFor } from "@/lib/submissions";
import { getContent } from "@/lib/tasks";
import type { Level, SpeakingTask, WritingTask } from "@/lib/content/schema";
import type { Feedback } from "@/lib/exchange/schema";
import { examConfig, labelMaps, contentLang } from "@/lib/exam/config";
import { singleTaskExamPoints } from "@/lib/scoring/writing";
import { speakingGoalIds } from "@/lib/exchange/prompts";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, SourceBadge, formatDate, btn } from "../ui";
import { GradingPanel } from "./GradingPanel";
import { FeedbackView } from "./FeedbackView";
import { VersionCompare, type VersionInfo } from "./VersionCompare";
import { DeleteSubmissionButton } from "./DeleteSubmissionButton";
import { ModelAnswer } from "./ModelAnswer";
import { SampleAnswer } from "../speaking/SampleAnswer";

/** Shared page body for /iras/beadas/[id] and /szobeli/beadas/[id]. */
export function SubmissionDetail({ id, kind, base, partName }: { id: string; kind: "writing" | "speaking"; base: string; partName: string }) {
  const sub = getSubmission(id);
  if (!sub || sub.kind !== kind) notFound();
  const task = getContent(sub.taskId) as WritingTask | SpeakingTask | null;
  const level = sub.level as Level;
  const ref = rubricRefFor(kind, level, task);
  const labels = labelMaps();
  const versions = versionsOf(sub.rootId);
  const fb = sub.feedback as Feedback | null;

  const pointLabels: Record<string, string> = {};
  if (task && kind === "writing") for (const p of (task as WritingTask).points) pointLabels[p.id] = p.text;
  if (task && kind === "speaking") {
    const st = task as SpeakingTask;
    const ids = speakingGoalIds(st);
    const texts = st.situation ? st.situation.goals : st.type === "presentation" ? st.prompts : [];
    ids.forEach((gid, i) => {
      if (texts[i]) pointLabels[gid] = texts[i]!;
    });
  }

  let examPoints: { points: number; max: number; note: string } | null = null;
  if (fb && kind === "writing" && task) {
    const rubric = examConfig.writingRubric(level);
    const r = singleTaskExamPoints(rubric, (task as WritingTask).taskNumber, fb.totalScore);
    examPoints = { ...r, note: `A(z) ${(task as WritingTask).taskNumber}. feladat aránya a(z) ${rubric.examMaxPoints} pontos íráskészség-részből` };
  }

  const versionInfos: VersionInfo[] = versions.map((v) => ({
    id: v.id,
    version: v.version,
    text: v.text,
    score: v.score,
    maxScore: v.maxScore,
    wordCount: v.wordCount,
    criteria: Object.fromEntries(((v.feedback as Feedback | null)?.criteria ?? []).map((c) => [c.id, c.score])),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className="text-muted hover:underline">
          ← {partName}
        </Link>
        {task && <SourceBadge source={task.source} />}
        <Badge>{t.writing.version(sub.version)}</Badge>
        <Badge tone={sub.status === "graded" ? "good" : "warn"}>{sub.status === "graded" ? t.writing.graded : t.writing.pending}</Badge>
        <span className="text-muted">{formatDate(sub.createdAt)}</span>
      </div>
      <h1 className="text-2xl font-semibold">{task?.title ?? sub.taskId}</h1>

      {versions.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {versions.map((v) => (
            <Link key={v.id} href={`${base}/beadas/${v.id}`} className={v.id === sub.id ? btn.primary : btn.secondary}>
              {t.writing.version(v.version)}
              {v.score !== null ? ` · ${v.score}/${v.maxScore}` : ""}
            </Link>
          ))}
        </div>
      )}

      {sub.status !== "graded" || !fb ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={kind === "writing" ? t.writing.yourSubmissions : t.speaking.transcript}>
            <div className="mb-2 text-xs text-muted">
              {t.writing.wordCount(sub.wordCount)}
              {sub.durationSec ? ` · ${Math.round(sub.durationSec / 60)} ${t.common.minutes}` : ""}
            </div>
            <div lang={contentLang()} className="reading-text whitespace-pre-wrap" data-testid="submitted-text">
              {sub.text}
            </div>
          </Card>
          <GradingPanel submissionId={sub.id} prompt={gradingPromptFor(sub)} />
        </div>
      ) : (
        <>
          <FeedbackView
            submissionId={sub.id}
            text={sub.text}
            feedback={fb}
            criteria={ref.criteria.map((c) => ({ id: c.id, name: c.name, max: c.max }))}
            pointLabels={pointLabels}
            categoryNames={labels.categories}
            examPoints={examPoints}
          />
          <div className="flex flex-wrap gap-2">
            {kind === "writing" && (
              <Link href={`${base}/${sub.taskId}?parent=${sub.id}`} className={btn.primary} data-testid="rewrite">
                ✎ {t.writing.rewrite}
              </Link>
            )}
            {kind === "speaking" && (
              <Link href={`${base}/${sub.taskId}`} className={btn.primary}>
                ↻ {t.task.tryAgain}
              </Link>
            )}
          </div>
        </>
      )}

      {kind === "writing" && task && sub.status === "graded" && <ModelAnswer task={task as WritingTask} />}
      {kind === "speaking" && task && sub.status === "graded" && <SampleAnswer task={task as SpeakingTask} />}

      {versions.length > 1 && <VersionCompare versions={versionInfos} criteria={ref.criteria.map((c) => ({ id: c.id, name: c.name, max: c.max }))} />}
      <div className="pt-4">
        <DeleteSubmissionButton id={sub.id} back={base} />
      </div>
    </div>
  );
}

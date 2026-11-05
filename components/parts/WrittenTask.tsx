import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaskRow } from "@/lib/tasks";
import { getSubmission, listSubmissions } from "@/lib/submissions";
import type { WritingTask } from "@/lib/content/schema";
import { examConfig, topicName, taskTypeName } from "@/lib/exam/config";
import { t } from "@/lib/i18n/hu";
import { Badge, SourceBadge } from "@/components/ui";
import { WritingEditor } from "@/components/writing/WritingEditor";
import type { ExamPart } from "@/lib/exam/config";
import { GuideLink } from "@/components/guides/GuideLink";
import { ModelAnswer } from "@/components/grading/ModelAnswer";

/** One written task (writing editor, submission, model answer). */
export function WrittenTask({ part, id, sp }: { part: ExamPart; id: string; sp: { mode?: string; parent?: string } }) {
  const base = `/${part.slug}`;
  const row = getTaskRow(id);
  if (!row || row.section !== "writing") notFound();
  const task = row.content as WritingTask;
  const parent = sp.parent ? getSubmission(sp.parent) : undefined;
  const mode = sp.mode === "exam" ? "exam" : "practice";
  const rubric = examConfig.writingRubric(task.level);
  const rt = rubric.tasks.find((x) => x.taskNumber === task.taskNumber);
  const attempted = listSubmissions("writing").some((x) => x.taskId === task.id);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className="text-muted hover:underline">
          ← {part.name}
        </Link>
        <SourceBadge source={task.source} />
        <Badge>{task.taskNumber}. feladat</Badge>
        <Badge>{taskTypeName("writing", task.type)}</Badge>
        <Badge>{topicName(task.topic)}</Badge>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <GuideLink type="writing" target={task.type} label={t.guides.open(taskTypeName("writing", task.type))} />
      </div>
      <WritingEditor
        base={base}
        task={task}
        mode={mode}
        parent={parent && parent.taskId === task.id ? { id: parent.id, text: parent.text, version: parent.version } : null}
        examMinutes={rt?.suggestedMinutes ?? task.suggestedMinutes}
      />
      {task.modelAnswer && mode === "practice" && (
        <div className="mt-6">
          {attempted ? <ModelAnswer task={task} /> : <p className="text-sm text-muted">ⓘ {t.writing.modelAnswerLocked}</p>}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaskRow } from "@/lib/tasks";
import { getSubmission, listSubmissions } from "@/lib/submissions";
import type { WritingTask } from "@/lib/content/schema";
import { examConfig, topicName, taskTypeName } from "@/lib/exam/config";
import { t } from "@/lib/i18n/hu";
import { Badge, SourceBadge } from "@/components/ui";
import { WritingEditor } from "./WritingEditor";
import { ModelAnswer } from "@/components/grading/ModelAnswer";

export const metadata: Metadata = { title: t.writing.title };

export default async function WritingTaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; parent?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
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
        <Link href="/iras" className="text-muted hover:underline">
          ← {t.writing.title}
        </Link>
        <SourceBadge source={task.source} />
        <Badge>{task.taskNumber}. feladat</Badge>
        <Badge>{taskTypeName("writing", task.type)}</Badge>
        <Badge>{topicName(task.topic)}</Badge>
      </div>
      <h1 className="mb-4 text-2xl font-semibold">{task.title}</h1>
      <WritingEditor
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskRow } from "@/lib/tasks";
import type { SpeakingTask } from "@/lib/content/schema";
import { examConfig, levelStructure, taskTypeName, topicName } from "@/lib/exam/config";
import { examinerPrompt } from "@/lib/exchange/prompts";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { Badge, SourceBadge } from "@/components/ui";
import { SpeakingPractice } from "@/components/speaking/SpeakingPractice";
import type { ExamPart } from "@/lib/exam/config";
import { GuideLink } from "@/components/guides/GuideLink";
import { SampleAnswer } from "@/components/speaking/SampleAnswer";

/** One oral task (practice with recording / typed transcript, examiner prompt, sample answer). */
export function OralTask({ part, id }: { part: ExamPart; id: string }) {
  const base = `/${part.slug}`;
  const row = getTaskRow(id);
  if (!row || row.section !== "speaking") notFound();
  const task = row.content as SpeakingTask;
  const s = getSettings();
  const oralPart = levelStructure(task.level).oral?.parts.find((p) => p.number === task.partNumber);
  const prompt = examinerPrompt({ level: task.level, task, topicName: topicName(task.topic), oralPartName: oralPart ? `${oralPart.number}. ${oralPart.name}` : String(task.partNumber), subject: { id: examConfig.subject().id, name: examConfig.subject().name, language: examConfig.subject().language } });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className="text-muted hover:underline">
          ← {part.name}
        </Link>
        <SourceBadge source={task.source} />
        <Badge>
          {task.partNumber}. {oralPart?.name ?? ""}
        </Badge>
        <Badge>{taskTypeName("speaking", task.type)}</Badge>
        <Badge>{topicName(task.topic)}</Badge>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <GuideLink type="speaking" target={task.type} label={t.guides.open(taskTypeName("speaking", task.type))} />
      </div>
      <SpeakingPractice task={task} examinerPrompt={prompt} ttsRate={s.ttsRate} base={base} language={examConfig.subject().language} />
      {task.sampleAnswer && (
        <div className="mt-6">
          <SampleAnswer task={task} />
        </div>
      )}
    </div>
  );
}

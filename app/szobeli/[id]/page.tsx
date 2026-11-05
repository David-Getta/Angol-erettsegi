import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskRow } from "@/lib/tasks";
import type { SpeakingTask } from "@/lib/content/schema";
import { levelStructure, topicName } from "@/lib/exam/config";
import { examinerPrompt } from "@/lib/exchange/prompts";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { Badge, SourceBadge } from "@/components/ui";
import { SpeakingPractice } from "./SpeakingPractice";
import { GuideLink } from "@/components/guides/GuideLink";
import { SampleAnswer } from "@/components/speaking/SampleAnswer";

export const metadata: Metadata = { title: t.speaking.title };

export default async function SpeakingTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getTaskRow(id);
  if (!row || row.section !== "speaking") notFound();
  const task = row.content as SpeakingTask;
  const s = getSettings();
  const part = levelStructure(task.level).oral.parts.find((p) => p.number === task.partNumber);
  const prompt = examinerPrompt({ level: task.level, task, topicName: topicName(task.topic), oralPartName: part ? `${part.number}. ${part.name}` : String(task.partNumber) });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/szobeli" className="text-muted hover:underline">
          ← {t.speaking.title}
        </Link>
        <SourceBadge source={task.source} />
        <Badge>
          {task.partNumber}. {part?.name ?? ""}
        </Badge>
        <Badge>{t.speaking.types[task.type]}</Badge>
        <Badge>{topicName(task.topic)}</Badge>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <GuideLink type="speaking" target={task.type} label={t.guides.open(t.speaking.types[task.type] ?? task.type)} />
      </div>
      <SpeakingPractice task={task} examinerPrompt={prompt} ttsRate={s.ttsRate} />
      {task.sampleAnswer && (
        <div className="mt-6">
          <SampleAnswer task={task} />
        </div>
      )}
    </div>
  );
}

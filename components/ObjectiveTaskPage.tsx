import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskRow } from "@/lib/tasks";
import type { ObjectiveSection, ObjectiveTask } from "@/lib/content/schema";
import { topicName, taskTypeName, labelMaps, levelStructure } from "@/lib/exam/config";
import { acceptNearMiss } from "@/lib/attempts";
import { getSettings } from "@/lib/settings";
import { t, sectionLabel } from "@/lib/i18n/hu";
import { Badge, SourceBadge, btn } from "./ui";
import { examSecondsFor } from "./TaskList";
import { PracticeRunner } from "./exercise/PracticeRunner";
import { ListeningRunner } from "./listening/ListeningRunner";

/** Shared page body for /olvasas/[id], /nyelvhelyesseg/[id], /hallas/[id]. */
export function ObjectiveTaskPage({ id, section, base, mode }: { id: string; section: ObjectiveSection; base: string; mode: "practice" | "exam" }) {
  const row = getTaskRow(id);
  if (!row || row.section !== section) notFound();
  const task = row.content as ObjectiveTask;
  const labels = labelMaps();
  const s = getSettings();
  const common = {
    task,
    mode,
    timeLimitSec: examSecondsFor(section, task.level, task.suggestedMinutes),
    categoryNames: labels.categories,
    acceptNearMiss: acceptNearMiss(section),
    backHref: base,
    wordCards: section !== "listening",
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href={base} className="text-muted hover:underline">
          ← {sectionLabel(section)}
        </Link>
        <SourceBadge source={task.source} />
        <Badge>{taskTypeName(section, task.type)}</Badge>
        <Badge>{topicName(task.topic)}</Badge>
        <span className="ml-auto flex gap-2">
          <Link href={`${base}/${id}`} className={mode === "practice" ? btn.primary : btn.secondary}>
            {t.mode.practice}
          </Link>
          <Link href={`${base}/${id}?mode=exam`} className={mode === "exam" ? btn.primary : btn.secondary}>
            ⏱ {t.mode.exam}
          </Link>
        </span>
      </div>
      <h1 className="mb-1 text-2xl font-semibold">{task.title}</h1>
      <p className="mb-4 text-sm text-muted">{mode === "exam" ? t.mode.examHint : t.mode.practiceHint}</p>
      {section === "listening" ? (
        <ListeningRunner
          key={mode}
          {...common}
          ttsRate={s.ttsRate}
          voices={{ female: s.ttsVoiceFemale, male: s.ttsVoiceMale }}
          prepSeconds={levelStructure(task.level).listening?.prepSeconds ?? 60}
          pauseSeconds={levelStructure(task.level).listening?.pauseSeconds ?? 30}
        />
      ) : (
        <PracticeRunner key={mode} {...common} />
      )}
    </div>
  );
}

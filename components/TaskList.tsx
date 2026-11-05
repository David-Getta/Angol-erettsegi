import Link from "next/link";
import type { Level, ObjectiveSection } from "@/lib/content/schema";
import { listTasks, contentStock } from "@/lib/tasks";
import { examConfig, topicName, taskTypeName } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import { t, sectionLabel } from "@/lib/i18n/hu";
import { Badge, Empty, SourceBadge, pct, btn } from "./ui";
import { CommandTip } from "./CommandTip";

/** Task picker for reading / language use / listening, grouped by task type. */
export function TaskList({ section, level, base, showReserved }: { section: ObjectiveSection; level: Level; base: string; showReserved: boolean }) {
  const all = listTasks(section, level);
  const tasks = all.filter((x) => showReserved || !x.reservedFor);
  const hiddenReserved = all.length - tasks.length;
  const types = examConfig.taskTypes()[section];
  const stock = contentStock(level).filter((r) => r.section === section);
  const low = stock.filter((r) => r.low);
  const totalUnused = stock.reduce((n, r) => n + r.unused, 0);
  const app = examConfig.app();
  const groups = new Map<string, typeof tasks>();
  for (const x of tasks) groups.set(x.type, [...(groups.get(x.type) ?? []), x]);
  const order = [...groups.keys()].sort((a, b) => types.findIndex((x) => x.id === a) - types.findIndex((x) => x.id === b));

  return (
    <div className="space-y-6">
      {(totalUnused <= app.lowStock.threshold || low.length > 0) && (
        <CommandTip
          command={feladatokCommand(section, level, app.lowStock.suggestCount)}
          message={t.tips.lowStock(low.length ? low.map((r) => r.typeName).join(", ") : sectionLabel(section))}
          dismissKey={`low-${section}-${level}-${totalUnused}`}
        />
      )}
      {tasks.length === 0 && <Empty>{t.common.empty}</Empty>}
      {order.map((type) => (
        <section key={type}>
          <h2 className="mb-2 flex flex-wrap items-baseline gap-2 text-lg font-semibold">
            {taskTypeName(section, type)}
            <span className="text-sm font-normal text-muted">{types.find((x) => x.id === type)?.description}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.get(type)!.map((x) => (
              <li key={x.id} className="flex flex-col rounded-xl border border-border bg-surface p-4" data-testid={`task-${x.id}`}>
                <div className="flex flex-wrap gap-1.5">
                  <SourceBadge source={x.source} />
                  <Badge>{topicName(x.topic)}</Badge>
                  {x.reservedFor && <Badge tone="warn">{t.common.reserved[x.reservedFor]}</Badge>}
                </div>
                <div className="mt-2 flex-1 font-medium">{x.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {x.itemCount} {t.common.items} ·{" "}
                  {x.attempts === 0 ? t.common.notDone : `${t.common.doneTimes(x.attempts)} · ${t.common.best}: ${pct(x.bestPct)}`}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`${base}/${x.id}`} className={btn.small} data-testid={`practice-${x.id}`}>
                    {t.mode.practice}
                  </Link>
                  <Link href={`${base}/${x.id}?mode=exam`} className={btn.small} data-testid={`exam-${x.id}`}>
                    ⏱ {t.mode.exam}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hiddenReserved > 0 && (
        <Link href={`${base}?foglalt=1`} className="text-sm text-muted hover:underline">
          {t.common.showReserved} ({hiddenReserved})
        </Link>
      )}
    </div>
  );
}

/** Exam-mode time for a single task: suggested minutes, or the part's time divided by its task count. */
export function examSecondsFor(section: ObjectiveSection, level: Level, suggestedMinutes?: number): number {
  if (suggestedMinutes) return Math.round(suggestedMinutes * 60);
  const p = examConfig.structure().levels[level].parts.find((x) => x.id === section);
  const n = p?.mockTaskCount ?? 4;
  return Math.round(((p?.timeMin ?? 60) / n) * 60);
}

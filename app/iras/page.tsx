import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listTasks, contentStock } from "@/lib/tasks";
import { listSubmissions } from "@/lib/submissions";
import { pendingInbox } from "@/lib/exchange/files";
import { examConfig, topicName, taskTypeName } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import type { WritingTask } from "@/lib/content/schema";
import { getWriting } from "@/lib/tasks";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, SourceBadge, Empty, formatDate, pct } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ImportButton } from "@/components/grading/ImportButton";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.writing.title };

export default function WritingListPage() {
  const s = getSettings();
  const tasks = listTasks("writing", s.level);
  const rubric = examConfig.writingRubric(s.level);
  const subs = listSubmissions("writing").filter((x) => x.level === s.level);
  const pending = pendingInbox().filter((id) => id.startsWith("w-"));
  const stock = contentStock(s.level).filter((r) => r.section === "writing");
  const lowStock = stock.length === 0 || stock.reduce((n, r) => n + r.unused, 0) <= examConfig.app().lowStock.threshold;
  const taskTitle = new Map(tasks.map((x) => [x.id, x.title]));

  return (
    <div>
      <PageHeader title={t.writing.title} intro={t.writing.intro} actions={<ReloadContentButton />} />
      {pending.length > 0 && (
        <CommandTip command="/javitas" message={`${t.dashboard.pendingCount(pending.length)}. ${t.tips.grading}`} testId="javitas-tip">
          <ImportButton variant="secondary" />
        </CommandTip>
      )}
      {lowStock && (
        <CommandTip
          command={feladatokCommand("writing", s.level, examConfig.app().lowStock.suggestCount)}
          message={t.tips.lowStock(t.section.writing)}
          dismissKey={`low-writing-${s.level}`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {rubric.tasks.map((rt) => {
            const list = tasks.filter((x) => (getWriting(x.id) as WritingTask | null)?.taskNumber === rt.taskNumber);
            return (
              <section key={rt.taskNumber}>
                <h2 className="mb-2 text-lg font-semibold">
                  {rt.taskNumber}. feladat – {rt.name}{" "}
                  <span className="text-sm font-normal text-muted">
                    ({rt.wordLimit.min}–{rt.wordLimit.max} {t.common.words})
                  </span>
                </h2>
                {list.length === 0 ? (
                  <Empty>{t.common.empty}</Empty>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {list.map((x) => (
                      <li key={x.id}>
                        <Link href={`/iras/${x.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-accent" data-testid={`task-${x.id}`}>
                          <div className="flex flex-wrap gap-1.5">
                            <SourceBadge source={x.source} />
                            <Badge>{taskTypeName("writing", x.type)}</Badge>
                          </div>
                          <div className="mt-2 font-medium">{x.title}</div>
                          <div className="mt-1 text-xs text-muted">{topicName(x.topic)}</div>
                          <div className="mt-2 text-xs">
                            {x.attempts === 0 ? (
                              <span className="text-muted">{t.common.notDone}</span>
                            ) : (
                              <span>
                                {t.common.doneTimes(x.attempts)} · {t.common.last}: {pct(x.lastPct)}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <Card title={t.writing.yourSubmissions}>
          {subs.length === 0 ? (
            <p className="text-sm text-muted">{t.writing.noSubmissions}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {subs.slice(0, 30).map((x) => (
                <li key={x.id} className="py-2">
                  <Link href={`/iras/beadas/${x.id}`} className="block hover:underline">
                    <div className="font-medium">{taskTitle.get(x.taskId) ?? x.taskId}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{t.writing.version(x.version)}</span>
                      <span>{formatDate(x.createdAt)}</span>
                      {x.status === "graded" ? (
                        <Badge tone="good">
                          {x.score} / {x.maxScore}
                        </Badge>
                      ) : (
                        <Badge tone="warn">{t.writing.pending}</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

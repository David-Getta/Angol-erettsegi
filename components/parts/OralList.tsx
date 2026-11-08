import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listTasks, contentStock, filterByOrigin, type Origin } from "@/lib/tasks";
import { OriginFilter } from "@/components/OriginFilter";
import { listSubmissions } from "@/lib/submissions";
import { pendingInbox } from "@/lib/exchange/files";
import { examConfig, levelStructure, taskTypeName } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import type { SpeakingTask } from "@/lib/content/schema";
import { getSpeaking } from "@/lib/tasks";
import { GuideLink, GuideLinks } from "@/components/guides/GuideLink";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, SourceBadge, formatDate, btn } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ImportButton } from "@/components/grading/ImportButton";
import { ReloadContentButton } from "@/components/ReloadContentButton";

import type { ExamPart } from "@/lib/exam/config";

/** List page of the oral part (speaking tasks / tételek), filterable by topic. */
export function OralList({ part, tema, origin }: { part: ExamPart; tema?: string; origin?: Origin }) {
  const s = getSettings();
  const base = `/${part.slug}`;
  const topics = examConfig.topics().topics;
  const oral = levelStructure(s.level).oral;
  const everything = listTasks("speaking", s.level).filter((x) => !tema || x.topic === tema);
  const tasks = filterByOrigin(everything, origin);
  const subs = listSubmissions("speaking").filter((x) => x.level === s.level);
  const mine = new Set(subs.map((x) => x.id));
  const pending = pendingInbox().filter((id) => mine.has(id));
  const stock = contentStock(s.level).filter((r) => r.section === "speaking");
  const titles = new Map(listTasks("speaking", s.level).map((x) => [x.id, x.title]));

  return (
    <div>
      <PageHeader title={part.name} intro={part.intro ?? t.speaking.intro} actions={
          <>
            <GuideLink type="exam" target={part.id} label={t.guides.strategy} />
            <ReloadContentButton />
          </>
        } />
      <GuideLinks type="speaking" title={t.guides.byTaskType} names={Object.fromEntries(examConfig.taskTypes().speaking.map((x) => [x.id, x.name]))} />
      <OriginFilter items={everything} origin={origin} href={(o) => `${base}?${new URLSearchParams({ ...(tema ? { tema } : {}), ...(o ? { forras: o } : {}) }).toString()}`} />
      {pending.length > 0 && (
        <CommandTip command="/javitas" message={`${t.dashboard.pendingCount(pending.length)}. ${t.tips.grading}`} testId="javitas-tip">
          <ImportButton variant="secondary" />
        </CommandTip>
      )}
      {stock.reduce((n, r) => n + r.unused, 0) <= examConfig.app().lowStock.threshold && (
        <CommandTip command={feladatokCommand(examConfig.subject().id, part.slug, s.level, 6, tema)} message={t.tips.lowStock(part.name)} dismissKey={`low-speaking-${s.level}`} />
      )}
      {oral && (
      <Card className="mb-6" title={`${part.name} felépítése (${t.level[s.level]}, kb. ${oral.durationMin} perc)`}>
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {oral.parts.map((p) => (
            <li key={p.number} className="rounded-lg bg-surface-2/60 p-3">
              <b>
                {p.number}. {p.name}
              </b>
              {p.minutes && <span className="text-muted"> · {p.minutes} perc</span>}
              <div className="text-muted">{p.description}</div>
            </li>
          ))}
        </ol>
      </Card>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href={base} className={!tema ? btn.primary : btn.small}>
          {t.common.all}
        </Link>
        {topics.map((tp) => (
          <Link key={tp.id} href={`${base}?tema=${tp.id}`} className={tema === tp.id ? btn.primary : btn.small}>
            {tp.number}. {tp.name}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {(oral?.parts ?? [{ number: 1, name: part.name, description: "" }]).map((p) => {
            const list = tasks.filter((x) => (getSpeaking(x.id) as SpeakingTask | null)?.partNumber === p.number);
            if (!list.length) return null;
            return (
              <section key={p.number}>
                <h2 className="mb-2 text-lg font-semibold">
                  {p.number}. {p.name}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {list.map((x) => (
                    <li key={x.id}>
                      <Link href={`${base}/${x.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-accent" data-testid={`task-${x.id}`}>
                        <div className="flex flex-wrap gap-1.5">
                          <SourceBadge source={x.source} tags={x.tags} />
                          <Badge>{taskTypeName("speaking", x.type)}</Badge>
                          <Badge>{topics.find((tp) => tp.id === x.topic)?.name ?? x.topic}</Badge>
                        </div>
                        <div className="mt-2 font-medium">{x.title}</div>
                        <div className="mt-1 text-xs text-muted">{x.attempts ? t.common.doneTimes(x.attempts) : t.common.notDone}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
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
                  <Link href={`${base}/beadas/${x.id}`} className="block hover:underline">
                    <div className="font-medium">{titles.get(x.taskId) ?? x.taskId}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{formatDate(x.createdAt)}</span>
                      {x.status === "graded" ? <Badge tone="good">{x.score} / {x.maxScore}</Badge> : <Badge tone="warn">{t.writing.pending}</Badge>}
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

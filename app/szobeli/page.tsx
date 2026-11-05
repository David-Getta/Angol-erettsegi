import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listTasks, contentStock } from "@/lib/tasks";
import { listSubmissions } from "@/lib/submissions";
import { pendingInbox } from "@/lib/exchange/files";
import { examConfig, levelStructure } from "@/lib/exam/config";
import { feladatokCommand } from "@/lib/commands/build";
import type { SpeakingTask } from "@/lib/content/schema";
import { getSpeaking } from "@/lib/tasks";
import { GuideLink } from "@/components/guides/GuideLink";
import { t } from "@/lib/i18n/hu";
import { Badge, Card, PageHeader, SourceBadge, formatDate, btn } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ImportButton } from "@/components/grading/ImportButton";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.speaking.title };

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const { tema } = await searchParams;
  const s = getSettings();
  const topics = examConfig.topics().topics;
  const oral = levelStructure(s.level).oral;
  const tasks = listTasks("speaking", s.level).filter((x) => !tema || x.topic === tema);
  const subs = listSubmissions("speaking").filter((x) => x.level === s.level);
  const pending = pendingInbox().filter((id) => id.startsWith("s-"));
  const stock = contentStock(s.level).filter((r) => r.section === "speaking");
  const titles = new Map(listTasks("speaking", s.level).map((x) => [x.id, x.title]));

  return (
    <div>
      <PageHeader title={t.speaking.title} intro={t.speaking.intro} actions={
          <>
            <GuideLink type="exam" target="speaking" label={t.guides.strategy} />
            <ReloadContentButton />
          </>
        } />
      {pending.length > 0 && (
        <CommandTip command="/javitas" message={`${t.dashboard.pendingCount(pending.length)}. ${t.tips.grading}`} testId="javitas-tip">
          <ImportButton variant="secondary" />
        </CommandTip>
      )}
      {stock.reduce((n, r) => n + r.unused, 0) <= examConfig.app().lowStock.threshold && (
        <CommandTip command={feladatokCommand("speaking", s.level, 6, tema)} message={t.tips.lowStock(t.section.speaking)} dismissKey={`low-speaking-${s.level}`} />
      )}
      <Card className="mb-6" title={`Szóbeli felépítése (${t.level[s.level]}, kb. ${oral.durationMin} perc)`}>
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
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href="/szobeli" className={!tema ? btn.primary : btn.small}>
          {t.common.all}
        </Link>
        {topics.map((tp) => (
          <Link key={tp.id} href={`/szobeli?tema=${tp.id}`} className={tema === tp.id ? btn.primary : btn.small}>
            {tp.number}. {tp.name}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {oral.parts.map((p) => {
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
                      <Link href={`/szobeli/${x.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-accent" data-testid={`task-${x.id}`}>
                        <div className="flex flex-wrap gap-1.5">
                          <SourceBadge source={x.source} />
                          <Badge>{t.speaking.types[x.type] ?? x.type}</Badge>
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
                  <Link href={`/szobeli/beadas/${x.id}`} className="block hover:underline">
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

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { examConfig, partName, partPath, taskTypeName } from "@/lib/exam/config";
import { topicOverviews, TOPIC_SECTIONS } from "@/lib/topics";
import { feladatokCommand } from "@/lib/commands/build";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { AddDeckButton } from "@/app/szokincs/VocabClient";
import { t } from "@/lib/i18n/hu";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const topic = examConfig.topics().topics.find((x) => x.id === id);
  return { title: `${topic?.name ?? id} – ${t.topics.title}` };
}

export default async function TopicPage({ params }: Props) {
  const { id } = await params;
  const level = getSettings().level;
  const x = topicOverviews(level).find((o) => o.topic.id === id);
  if (!x) notFound();
  const firstPart = TOPIC_SECTIONS.find((p) => x.tasks[p] !== undefined && partPath(p) !== `/${p}`) ?? "reading";
  return (
    <div>
      <PageHeader
        title={`${x.topic.number}. ${x.topic.name}`}
        intro={x.topic.nameEn}
        actions={
          <Link href="/temakorok" className="text-sm text-muted hover:underline">
            ← {t.topics.title}
          </Link>
        }
      />
      <div className="mb-5 max-w-md">
        <ProgressBar value={x.done} max={Math.max(1, x.total)} tone="good" />
        <p className="mt-1 text-sm text-muted">{t.topics.done(x.done, x.total)}</p>
      </div>
      {x.topic.subtopics.length > 0 && (
        <Card className="mb-5" title={t.topics.subtopics}>
          <p className="text-sm">{x.topic.subtopics.join(" · ")}</p>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {TOPIC_SECTIONS.map((s) => (
          <Card key={s} title={partName(s)}>
            {x.tasks[s].length === 0 ? (
              <p className="text-sm text-muted">{t.topics.noTasks}</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid={`topic-${s}`}>
                {x.tasks[s].map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <Link href={`${partPath(s)}/${task.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                      {task.title}
                    </Link>
                    <span className="text-xs text-muted">{taskTypeName(s, task.type)}</span>
                    {task.attempts > 0 ? (
                      <Badge tone="good">{task.bestPct !== null ? t.topics.best(task.bestPct) : "✓"}</Badge>
                    ) : (
                      <Badge>{t.topics.todo}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        <Card title={t.topics.deck}>
          {x.deck ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {x.deck.title} · {t.topics.deckAdded(x.deck.added, x.deck.size)}
              </span>
              {x.deck.added < x.deck.size && <AddDeckButton deckId={x.deck.id} />}
            </div>
          ) : (
            <p className="text-sm text-muted">{t.topics.noDeck}</p>
          )}
        </Card>
      </div>
      <div className="mt-5">
        <CommandTip command={feladatokCommand(examConfig.subject().id, partPath(firstPart).slice(1), level, 2, x.topic.id)} message={t.topics.generate} dismissKey={`topic-gen-${x.topic.id}-${level}`} />
      </div>
    </div>
  );
}

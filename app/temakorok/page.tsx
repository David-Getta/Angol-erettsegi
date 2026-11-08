import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { topicOverviews, TOPIC_SECTIONS } from "@/lib/topics";
import { partName } from "@/lib/exam/config";
import { PageHeader, ProgressBar } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.topics.title };

export default function TopicsPage() {
  const level = getSettings().level;
  const topics = topicOverviews(level);
  return (
    <div>
      <PageHeader title={t.topics.title} intro={t.topics.intro} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="topic-list">
        {topics.map((x) => (
          <li key={x.topic.id}>
            <Link href={`/temakorok/${x.topic.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 shadow-sm hover:bg-surface-2">
              <div className="text-xs text-muted">{x.topic.number}.</div>
              <div className="font-semibold">{x.topic.name}</div>
              <div className="mt-2">
                <ProgressBar value={x.done} max={Math.max(1, x.total)} tone="good" />
              </div>
              <div className="mt-1 text-xs text-muted">{t.topics.done(x.done, x.total)}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {TOPIC_SECTIONS.map((s) => (
                  <span key={s}>
                    {partName(s)}: {x.tasks[s].length}
                  </span>
                ))}
                {x.deck && <span>🗂 {x.deck.added}/{x.deck.size}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

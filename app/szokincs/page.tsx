import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { deckStatuses, dueInfo, importVocabCompletions, incompleteCount, listCards, todayCounts } from "@/lib/vocab/cards";
import { topicName } from "@/lib/exam/config";
import { szokincsCommand } from "@/lib/commands/build";
import { t } from "@/lib/i18n/hu";
import { examConfig } from "@/lib/exam/config";
import { Card, PageHeader, Stat, btn, SourceBadge, ProgressBar } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { ImportButton } from "@/components/grading/ImportButton";
import { ReloadContentButton } from "@/components/ReloadContentButton";
import { AddDeckButton, ManualAddForm, CardTable } from "./VocabClient";

export const metadata: Metadata = { title: t.vocab.title };

export default async function VocabPage({ searchParams }: { searchParams: Promise<{ q?: string; hianyos?: string }> }) {
  const sp = await searchParams;
  importVocabCompletions(); // apply /szokincs results automatically
  const s = getSettings();
  const due = dueInfo();
  const today = todayCounts();
  const incomplete = incompleteCount();
  const decks = deckStatuses(s.level);
  const cards = listCards({ q: sp.q, incompleteOnly: !!sp.hianyos, limit: 400 });
  // one row per word
  const words = new Map<string, { key: string; front: string; back: string; example: string | null; collocation: string | null; incomplete: boolean; ids: number[]; suspended: boolean; types: string[]; due: string }>();
  for (const c of cards) {
    const w = words.get(c.noteKey) ?? { key: c.noteKey, front: c.front, back: c.back, example: c.example, collocation: c.collocation, incomplete: c.incomplete, ids: [], suspended: c.suspended, types: [], due: c.dueAt.toISOString() };
    w.ids.push(c.id);
    w.types.push(c.type);
    if (c.dueAt.toISOString() < w.due) w.due = c.dueAt.toISOString();
    words.set(c.noteKey, w);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.vocab.title} intro={t.vocab.intro} actions={<ReloadContentButton />} />
      {incomplete > 0 && (
        <CommandTip command="/szokincs" message={`${t.tips.incompleteCards(incomplete)}`} testId="szokincs-tip">
          <ImportButton variant="secondary" />
        </CommandTip>
      )}
      <Card>
        <div className="flex flex-wrap items-end gap-8">
          <Stat label={t.vocab.due} value={due.dueReviews} />
          <Stat label={t.vocab.new} value={`${due.newAllowed}`} hint={`${due.newAvailable} várakozik · napi limit ${s.dailyNewCards}`} />
          <Stat label="Ma" value={today.reviewed} hint={t.vocab.todayStats(today.reviewed, today.newDone)} />
          <div className="ml-auto">
            {due.total > 0 ? (
              <Link href="/szokincs/ismetles" className={btn.primary} data-testid="start-review">
                ▶ {t.vocab.review} ({due.total})
              </Link>
            ) : (
              <span className="text-muted">{t.vocab.noneDue}</span>
            )}
          </div>
        </div>
      </Card>

      <Card title={t.vocab.decks}>
        {decks.length === 0 ? (
          <CommandTip command={szokincsCommand(examConfig.subject().id, examConfig.topics().topics[0]?.id ?? null, s.level, 40)} message="Ezen a szinten még nincs pakli. Generálj egyet:" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <li key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <SourceBadge source={d.source} />
                  <span className="text-xs text-muted">{topicName(d.topic)}</span>
                </div>
                <div className="mt-1 font-medium">{d.title}</div>
                <div className="mt-2">
                  <ProgressBar value={d.added} max={d.size} tone={d.added === d.size ? "good" : "accent"} />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>
                      {d.added} / {d.size} {t.vocab.deckIn}
                    </span>
                    {d.added < d.size && <AddDeckButton deckId={d.id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t.vocab.addManual}>
        <ManualAddForm />
      </Card>

      <Card
        title={`${t.vocab.cards} (${words.size})`}
        actions={
          <form className="flex gap-2" action="/szokincs">
            <input name="q" defaultValue={sp.q} placeholder={t.vocab.search} className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="hianyos" value="1" defaultChecked={!!sp.hianyos} /> {t.vocab.incomplete}
            </label>
            <button className={btn.small}>OK</button>
          </form>
        }
      >
        <CardTable words={[...words.values()]} language={examConfig.subject().language} />
      </Card>
    </div>
  );
}

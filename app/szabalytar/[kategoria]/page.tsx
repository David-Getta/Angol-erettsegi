import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { examConfig } from "@/lib/exam/config";
import { getLesson } from "@/lib/lessons";
import { getSettings } from "@/lib/settings";
import { countBankItems } from "@/lib/targeted";
import { buildCommand } from "@/lib/commands/build";
import type { GrammarLesson } from "@/lib/content/schema";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { CommandTip } from "@/components/CommandTip";
import { LessonPractice } from "@/components/lessons/LessonPractice";
import { t } from "@/lib/i18n/hu";

type Props = { params: Promise<{ kategoria: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategoria } = await params;
  const cat = examConfig.errorCategories().categories.find((c) => c.id === kategoria);
  return { title: `${cat?.name ?? kategoria} – ${t.lessons.title}` };
}

function Rule({ rule }: { rule: GrammarLesson["rules"][number] }) {
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="flex flex-wrap items-center gap-2 font-semibold">
        {rule.title}
        {rule.emeltOnly && <Badge tone="accent">{t.lessons.emeltOnly}</Badge>}
      </h3>
      <p className="mt-1 whitespace-pre-line text-[15px]">{rule.explanation}</p>
      <ul className="mt-2 space-y-1.5">
        {rule.examples.map((ex, i) => (
          <li key={i} className="rounded-md bg-surface-2 px-3 py-1.5 text-sm">
            <span className="font-reading text-[15px]">{ex.en}</span>
            {ex.hu && <span className="block text-muted">{ex.hu}</span>}
            {ex.note && <span className="block text-xs text-muted">↳ {ex.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function LessonPage({ params }: Props) {
  const { kategoria } = await params;
  const categories = examConfig.errorCategories().categories;
  const cat = categories.find((c) => c.id === kategoria);
  if (!cat) notFound();
  const lesson = getLesson(cat.id);
  const level = getSettings().level;
  const names = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  if (!lesson) {
    return (
      <div>
        <PageHeader title={cat.name} intro={cat.description} />
        <Card>
          <p className="mb-3">{t.lessons.noLesson}</p>
          <CommandTip command={buildCommand("feladatok", ["szabaly", "kozep", 1, null, cat.id])} message={t.lessons.generateHint} />
        </Card>
      </div>
    );
  }

  const baseRules = lesson.rules.filter((r) => !r.emeltOnly);
  const emeltRules = lesson.rules.filter((r) => r.emeltOnly);
  const language = cat.group !== "comprehension";
  const bank = language ? countBankItems(cat.id, level) : 0;

  return (
    <div>
      <PageHeader
        title={lesson.title}
        intro={lesson.summaryHu}
        actions={
          <>
            <Link href="/szabalytar" className="text-sm text-muted hover:underline">
              ← {t.lessons.title}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card title={t.lessons.rules}>
            <div className="space-y-4" data-testid="lesson-rules">
              {baseRules.map((r, i) => (
                <Rule key={i} rule={r} />
              ))}
            </div>
            {emeltRules.length > 0 && (
              <details className="mt-4 rounded-lg border border-border p-3" open={level === "emelt"}>
                <summary className="cursor-pointer font-medium">{t.lessons.emeltRules}</summary>
                <div className="mt-3 space-y-4">
                  {emeltRules.map((r, i) => (
                    <Rule key={i} rule={r} />
                  ))}
                </div>
              </details>
            )}
          </Card>

          {lesson.commonMistakes.length > 0 && (
            <Card title={t.lessons.commonMistakes}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm" data-testid="lesson-mistakes">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="pb-1 pr-2">{t.lessons.wrong}</th>
                      <th className="pb-1 pr-2">{t.lessons.right}</th>
                      <th className="pb-1">{t.lessons.why}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lesson.commonMistakes.map((m, i) => (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="py-1.5 pr-2 font-reading text-bad line-through decoration-bad/50">{m.wrong}</td>
                        <td className="py-1.5 pr-2 font-reading font-medium text-good">{m.right}</td>
                        <td className="py-1.5">{m.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {lesson.practice.length > 0 && (
            <Card title={t.lessons.practice}>
              <p className="mb-3 text-sm text-muted">{t.lessons.practiceHint}</p>
              <LessonPractice category={cat.id} items={lesson.practice} />
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          {lesson.examTips.length > 0 && (
            <Card title={t.lessons.examTips}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {lesson.examTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <div className="flex flex-col gap-2">
              {language && bank > 0 && (
                <LinkButton href={`/nyelvhelyesseg/celzott?k=${cat.id}`} variant="secondary">
                  {t.lessons.practiceMore}
                </LinkButton>
              )}
              <LinkButton href={`/hibanaplo?k=${cat.id}`} variant="secondary">
                {t.lessons.showErrors}
              </LinkButton>
            </div>
          </Card>
          {lesson.relatedCategories.length > 0 && (
            <Card title={t.lessons.related}>
              <ul className="space-y-1 text-sm">
                {lesson.relatedCategories.map((r) => (
                  <li key={r}>
                    <Link href={`/szabalytar/${r}`} className="hover:underline">
                      {names[r] ?? r}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

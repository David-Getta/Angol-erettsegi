import type { Metadata } from "next";
import Link from "next/link";
import { lessonOverview } from "@/lib/lessons";
import { Badge, Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.lessons.title };

const GROUP_ORDER = ["grammar", "vocabulary", "writing", "comprehension"] as const;

export default function LessonsPage() {
  const all = lessonOverview();
  const top = all
    .filter((x) => x.lesson && x.errors30 > 0)
    .sort((a, b) => b.errors30 - a.errors30)
    .slice(0, 4);
  const missing = all.filter((x) => !x.lesson).length;

  return (
    <div>
      <PageHeader title={t.lessons.title} intro={t.lessons.intro} />

      {top.length > 0 && (
        <Card className="mb-6" title={t.lessons.topErrors}>
          <div className="flex flex-wrap gap-2" data-testid="lesson-top">
            {top.map((x) => (
              <Link key={x.category.id} href={`/szabalytar/${x.category.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                <span className="font-medium">{x.category.name}</span> <span className="text-muted">· {t.lessons.errors30(x.errors30)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {GROUP_ORDER.map((g) => {
          const items = all
            .filter((x) => x.category.group === g)
            .sort((a, b) => b.errors30 - a.errors30 || b.errorsTotal - a.errorsTotal || a.category.name.localeCompare(b.category.name, "hu"));
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 text-lg font-semibold">{t.lessons.groups[g]}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`lesson-group-${g}`}>
                {items.map((x) => (
                  <li key={x.category.id}>
                    <Link
                      href={`/szabalytar/${x.category.id}`}
                      className={`block h-full rounded-xl border border-border bg-surface p-3 shadow-sm hover:bg-surface-2 ${x.lesson ? "" : "opacity-70"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{x.category.name}</span>
                        {x.errorsTotal > 0 ? <Badge tone={x.errors30 > 0 ? "warn" : "neutral"}>{t.lessons.yourErrors(x.errorsTotal)}</Badge> : null}
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-muted">{x.lesson ? x.lesson.summary : t.lessons.noLesson}</p>
                      {x.lesson && x.lesson.practiceCount > 0 && <p className="mt-1.5 text-xs text-muted">{t.lessons.practiceCount(x.lesson.practiceCount)}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {missing > 0 && <p className="mt-6 text-sm text-muted">{t.lessons.missingCount(missing)}</p>}
    </div>
  );
}

import type { Metadata } from "next";
import { subjectCards } from "@/lib/subjects";
import { getSettings } from "@/lib/settings";
import { setSubjectAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.subjects.title };

const GROUPS = ["kotelezo", "nyelv", "termeszettudomany", "egyeb"] as const;

/** Start screen: pick the subject to study; every subject gets the same app. */
export default function SubjectsPage() {
  const cards = subjectCards();
  const current = getSettings().subject;
  return (
    <div>
      <PageHeader title={t.subjects.title} intro={t.subjects.intro} />
      <div className="space-y-8">
        {GROUPS.map((g) => {
          const list = cards.filter((c) => c.subject.group === g);
          if (!list.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-3 text-lg font-semibold">{t.subjects.groups[g]}</h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid={`subjects-${g}`}>
                {list.map((c) => (
                  <li key={c.subject.id}>
                    <form action={setSubjectAction} className="h-full">
                      <input type="hidden" name="subject" value={c.subject.id} />
                      <button
                        type="submit"
                        data-testid={`subject-${c.subject.id}`}
                        className={`flex h-full w-full flex-col rounded-2xl border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow ${
                          c.subject.id === current ? "border-accent ring-2 ring-accent/30" : "border-border"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl" aria-hidden>
                            {c.subject.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-semibold">{c.subject.name}</div>
                            <div className="text-xs text-muted">
                              {t.subjects.level}: {t.level[c.level]} · {t.subjects.days(c.daysLeft)}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 flex-1 text-sm text-muted">{c.subject.description}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-muted">
                            {c.taskCount > 0 ? t.subjects.tasks(c.taskCount) : t.subjects.noContent}
                            {c.estimate ? ` · ${t.subjects.estimate(c.estimate.points, c.estimate.max)}` : ""}
                          </span>
                          <span className="rounded-md bg-accent px-3 py-1 font-medium text-accent-fg">
                            {c.subject.id === current ? t.subjects.continue : t.subjects.open} →
                          </span>
                        </div>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

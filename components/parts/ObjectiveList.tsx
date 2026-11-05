import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { categoryStats } from "@/lib/errors/log";
import type { ExamPart } from "@/lib/exam/config";
import type { ObjectiveSection } from "@/lib/content/schema";
import { GuideLink } from "@/components/guides/GuideLink";
import { t } from "@/lib/i18n/hu";
import { Card, PageHeader, btn } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { ReloadContentButton } from "@/components/ReloadContentButton";

/** List page of an objective part (tasks with items): reading, language use, listening, short-answer papers … */
export function ObjectiveList({ part, showReserved }: { part: ExamPart; showReserved: boolean }) {
  const s = getSettings();
  const base = `/${part.slug}`;
  const groups = part.features.categoryGroups;
  const top = part.features.targeted
    ? categoryStats()
        .filter((c) => groups.length === 0 || groups.includes(c.group))
        .slice(0, 4)
    : [];
  return (
    <div>
      <PageHeader
        title={part.name}
        intro={part.intro}
        actions={
          <>
            <GuideLink type="exam" target={part.id} label={t.guides.strategy} />
            {part.features.audio && (
              <Link href={`${base}/diktalas`} className={btn.secondary} data-testid="dictation-link">
                {t.dictation.open}
              </Link>
            )}
            <ReloadContentButton />
          </>
        }
      />
      {part.features.targeted && (
        <Card title={t.languageUse.targeted} className="mb-6">
          <p className="text-sm text-muted">{t.languageUse.targetedIntro}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {top.length > 0 && (
              <Link href={`${base}/celzott?k=${top.map((c) => c.category).join(",")}`} className={btn.primary}>
                ▶ {t.languageUse.targetedTop}: {top.map((c) => c.name).join(", ")}
              </Link>
            )}
            <Link href={`${base}/celzott`} className={btn.secondary}>
              {t.languageUse.targetedPick}
            </Link>
          </div>
        </Card>
      )}
      <TaskList section={part.id as ObjectiveSection} level={s.level} base={base} showReserved={showReserved} />
    </div>
  );
}

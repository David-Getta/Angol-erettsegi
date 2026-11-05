import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { categoryStats } from "@/lib/errors/log";
import { GuideLink } from "@/components/guides/GuideLink";
import { t } from "@/lib/i18n/hu";
import { Card, PageHeader, btn } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.languageUse.title };

export default async function LanguageUsePage({ searchParams }: { searchParams: Promise<{ foglalt?: string }> }) {
  const sp = await searchParams;
  const s = getSettings();
  const top = categoryStats()
    .filter((c) => c.group === "grammar" || c.group === "vocabulary")
    .slice(0, 4);
  return (
    <div>
      <PageHeader title={t.languageUse.title} intro={t.languageUse.intro} actions={
          <>
            <GuideLink type="exam" target="language-use" label={t.guides.strategy} />
            <ReloadContentButton />
          </>
        } />
      <Card title={t.languageUse.targeted} className="mb-6">
        <p className="text-sm text-muted">{t.languageUse.targetedIntro}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {top.length > 0 && (
            <Link href={`/nyelvhelyesseg/celzott?k=${top.map((c) => c.category).join(",")}`} className={btn.primary}>
              ▶ {t.languageUse.targetedTop}: {top.map((c) => c.name).join(", ")}
            </Link>
          )}
          <Link href="/nyelvhelyesseg/celzott" className={btn.secondary}>
            {t.languageUse.targetedPick}
          </Link>
        </div>
      </Card>
      <TaskList section="language-use" level={s.level} base="/nyelvhelyesseg" showReserved={!!sp.foglalt} />
    </div>
  );
}

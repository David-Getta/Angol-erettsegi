import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { GuideLink } from "@/components/guides/GuideLink";
import { t } from "@/lib/i18n/hu";
import { PageHeader } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.listening.title };

export default async function Page({ searchParams }: { searchParams: Promise<{ foglalt?: string }> }) {
  const sp = await searchParams;
  const s = getSettings();
  return (
    <div>
      <PageHeader title={t.listening.title} intro={t.listening.intro} actions={
          <>
            <GuideLink type="exam" target="listening" label={t.guides.strategy} />
            <ReloadContentButton />
          </>
        } />
      <TaskList section="listening" level={s.level} base="/hallas" showReserved={!!sp.foglalt} />
    </div>
  );
}

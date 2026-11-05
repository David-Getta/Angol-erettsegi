import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { PageHeader } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { ReloadContentButton } from "@/components/ReloadContentButton";

export const metadata: Metadata = { title: t.reading.title };

export default async function Page({ searchParams }: { searchParams: Promise<{ foglalt?: string }> }) {
  const sp = await searchParams;
  const s = getSettings();
  return (
    <div>
      <PageHeader title={t.reading.title} intro={t.reading.intro} actions={<ReloadContentButton />} />
      <TaskList section="reading" level={s.level} base="/olvasas" showReserved={!!sp.foglalt} />
    </div>
  );
}

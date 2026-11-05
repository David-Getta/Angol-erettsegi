import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { levelStructure } from "@/lib/exam/config";
import { listBackups } from "@/lib/backup";
import { t } from "@/lib/i18n/hu";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: t.settings.title };

export default function SettingsPage() {
  const s = getSettings();
  const totals = { kozep: levelStructure("kozep").totalPoints, emelt: levelStructure("emelt").totalPoints };
  const backups = listBackups().map((b) => ({ name: b.name, size: b.size, at: b.at.toISOString() }));
  return (
    <div>
      <PageHeader title={t.settings.title} />
      <SettingsForm settings={s} totals={totals} backups={backups} />
    </div>
  );
}

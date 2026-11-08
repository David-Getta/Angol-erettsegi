import type { Metadata } from "next";
import { phraseBank } from "@/lib/phrases";
import { getSettings } from "@/lib/settings";
import { taskTypeName } from "@/lib/exam/config";
import { PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";
import { PhraseBank } from "./PhraseBank";

export const metadata: Metadata = { title: t.phrases.title };

export default function PhrasesPage() {
  const level = getSettings().level;
  const groups = phraseBank(level).map((g) => ({
    ...g,
    label: `${g.section === "writing" ? t.phrases.writing : t.phrases.speaking}: ${taskTypeName(g.section, g.type)}`,
  }));
  return (
    <div>
      <PageHeader title={t.phrases.title} intro={t.phrases.intro} />
      <PhraseBank groups={groups} />
    </div>
  );
}

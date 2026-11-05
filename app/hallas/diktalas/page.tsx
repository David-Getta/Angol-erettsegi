import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { dictationSentences } from "@/lib/dictation";
import { Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";
import { DictationRunner } from "./DictationRunner";

export const metadata: Metadata = { title: t.dictation.title };

export default function DictationPage() {
  const s = getSettings();
  const sentences = dictationSentences(s.level, 8);
  return (
    <div>
      <PageHeader
        title={t.dictation.title}
        intro={t.dictation.intro}
        actions={
          <Link href="/hallas" className="text-sm text-muted hover:underline">
            ← {t.listening.title}
          </Link>
        }
      />
      {sentences.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.dictation.none}</p>
        </Card>
      ) : (
        <DictationRunner sentences={sentences} rate={s.ttsRate} />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { dictationSentences } from "@/lib/dictation";
import { Card, PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n/hu";
import { DictationRunner } from "@/components/listening/DictationRunner";
import { notFound } from "next/navigation";
import { resolvePart } from "../parts";

export const metadata: Metadata = { title: t.dictation.title };

export default async function DictationPage({ params }: { params: Promise<{ resz: string }> }) {
  const { resz } = await params;
  const part = resolvePart(resz);
  if (!part.features.audio) notFound();
  const s = getSettings();
  const sentences = dictationSentences(s.level, 8);
  return (
    <div>
      <PageHeader
        title={t.dictation.title}
        intro={t.dictation.intro}
        actions={
          <Link href={`/${part.slug}`} className="text-sm text-muted hover:underline">
            ← {part.name}
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

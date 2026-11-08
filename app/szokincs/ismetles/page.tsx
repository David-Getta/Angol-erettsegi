import type { Metadata } from "next";
import { reviewQueue, clozeFor } from "@/lib/vocab/cards";
import { previewIntervals, type StoredFsrs } from "@/lib/vocab/fsrs";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { examConfig } from "@/lib/exam/config";
import { ReviewSession, type ReviewCard } from "./ReviewSession";

export const metadata: Metadata = { title: t.vocab.review };

export default function ReviewPage() {
  const s = getSettings();
  const queue: ReviewCard[] = reviewQueue().map((c) => ({
    id: c.id,
    type: c.type,
    front: c.front,
    back: c.back,
    example: c.example,
    collocation: c.collocation,
    context: c.context,
    cloze: c.example ? clozeFor(c.example, c.front) : null,
    collocationCloze: c.collocation ? clozeFor(c.collocation, c.front) : null,
    previews: previewIntervals(c.fsrsState as StoredFsrs),
    isNew: c.isNew,
  }));
  return (
    <>
      <h1 className="sr-only">{t.vocab.review}</h1>
      <ReviewSession initial={queue} ttsRate={s.ttsRate} language={examConfig.subject().language} speechLang={examConfig.subject().speechLang} languageName={examConfig.subject().languageName ?? "angol"} />
    </>
  );
}

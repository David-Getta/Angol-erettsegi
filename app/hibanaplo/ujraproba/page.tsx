import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { pickMistakes } from "@/lib/targeted";
import { examConfig } from "@/lib/exam/config";
import { t } from "@/lib/i18n/hu";
import { Card, PageHeader } from "@/components/ui";
import { TargetedRunner } from "@/components/exercise/TargetedRunner";

export const metadata: Metadata = { title: t.languageUse.review };

export default function MistakeReviewPage() {
  const s = getSettings();
  const { review } = examConfig.app();
  const names = Object.fromEntries(examConfig.errorCategories().categories.map((c) => [c.id, c.name]));
  const { due, later } = pickMistakes(s.level, review.itemsPerRound, review.minAgeHours);
  return (
    <div>
      <PageHeader
        title={t.languageUse.review}
        intro={t.languageUse.reviewIntro}
        actions={
          <Link href="/hibanaplo" className="text-sm text-muted hover:underline">
            ← {t.nav.errorLog}
          </Link>
        }
      />
      {due.length === 0 ? (
        <Card>
          <p data-testid="review-none">{t.languageUse.reviewNone}</p>
          {later > 0 && <p className="mt-1 text-sm text-muted">{t.languageUse.reviewLater(later)}</p>}
        </Card>
      ) : (
        <>
          <TargetedRunner items={due} categoryNames={names} />
          {later > 0 && <p className="mt-3 text-sm text-muted">{t.languageUse.reviewLater(later)}</p>}
        </>
      )}
    </div>
  );
}

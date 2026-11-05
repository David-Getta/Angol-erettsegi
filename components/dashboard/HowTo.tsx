"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/app/actions";
import { Card, btn } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

/** First-steps card on the dashboard until the student hides it (settings.onboardingDone). */
export function HowTo() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card
      title={t.dashboard.howTo}
      actions={
        <button
          type="button"
          className={btn.ghost}
          disabled={pending}
          data-testid="howto-hide"
          onClick={() =>
            start(async () => {
              await saveSettingsAction({ onboardingDone: true });
              router.refresh();
            })
          }
        >
          {t.dashboard.howToHide}
        </button>
      }
    >
      <ol className="list-decimal space-y-1.5 pl-5 text-sm" data-testid="howto">
        {t.dashboard.howToSteps.map((step) => (
          <li key={step.href}>
            <Link href={step.href} className="hover:underline">
              {step.text}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

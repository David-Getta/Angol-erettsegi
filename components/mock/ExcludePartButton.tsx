"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPartExcludedAction } from "@/app/actions-mock";
import type { PartId } from "@/lib/exam/config";
import { t } from "@/lib/i18n/hu";
import { btn } from "../ui";

/** Leaves one part of a finished diagnostic out of the result, or counts it again. */
export function ExcludePartButton({ mockId, part, excluded }: { mockId: number; part: PartId; excluded: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className={btn.small}
      disabled={pending}
      data-testid={`exclude-${part}`}
      title={excluded ? t.diagnostic.includeTitle : t.diagnostic.excludeTitle}
      onClick={() =>
        start(async () => {
          await setPartExcludedAction(mockId, part, !excluded);
          router.refresh();
        })
      }
    >
      {excluded ? `↺ ${t.diagnostic.include}` : `⊘ ${t.diagnostic.exclude}`}
    </button>
  );
}

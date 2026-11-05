"use client";

import { useState, useTransition } from "react";
import { addFixCardAction } from "@/app/actions-vocab";
import { t } from "@/lib/i18n/hu";

/** "＋ Ismétlésbe": turns one correction into a FSRS "fix" card. */
export function AddFixCardButton(props: { original: string; corrected: string; explanation: string; context?: string | null; sourceType: string; sourceId?: string | null }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <span className="text-xs text-good">✓ {t.vocab.fixAdded}</span>;
  return (
    <button
      type="button"
      className="text-xs text-accent hover:underline disabled:opacity-50"
      title={t.vocab.fixAddTitle}
      disabled={pending}
      data-testid="add-fix-card"
      onClick={() =>
        start(async () => {
          await addFixCardAction(props);
          setDone(true);
        })
      }
    >
      {t.vocab.fixAdd}
    </button>
  );
}

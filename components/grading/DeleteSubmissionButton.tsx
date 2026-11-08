"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import { deleteSubmissionAction } from "@/app/actions-grading";
import { btn } from "../ui";

export function DeleteSubmissionButton({ id, back }: { id: string; back: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={btn.ghost}
      onClick={async () => {
        if (!window.confirm(t.grading.deleteConfirm)) return;
        await deleteSubmissionAction(id);
        router.push(back);
      }}
    >
      🗑 {t.grading.deleteSubmission}
    </button>
  );
}

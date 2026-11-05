"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import { importFeedbackAction } from "@/app/actions-grading";
import { btn } from "../ui";

export function ImportButton({ variant = "primary" }: { variant?: keyof typeof btn }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const router = useRouter();
  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        data-testid="import-feedback"
        className={btn[variant]}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await importFeedbackAction();
            const lines: string[] = [];
            for (const f of r.failed) lines.push(`${f.id}: ${f.errors.join("; ")}`);
            for (const e of r.vocabErrors) lines.push(`completions.json: ${e}`);
            setErrors(lines);
            const parts: string[] = [];
            if (r.nothing && !r.vocabApplied) parts.push(t.grading.importNothing);
            else if (!r.nothing) parts.push(t.grading.importResult(r.imported.length, r.failed.length));
            if (r.vocabApplied) parts.push(`${r.vocabApplied} szókártya kiegészítve.`);
            setMsg(parts.join(" "));
            router.refresh();
          })
        }
      >
        ⇩ {pending ? t.grading.importing : t.grading.import}
      </button>
      {msg && (
        <span className="text-xs text-muted" data-testid="import-result">
          {msg}
        </span>
      )}
      {errors.length > 0 && (
        <ul className="text-xs text-bad">
          {errors.map((e) => (
            <li key={e}>✗ {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import { pasteFeedbackAction } from "@/app/actions-grading";
import { CommandTip } from "../CommandTip";
import { CopyButton } from "../CopyButton";
import { ImportButton } from "./ImportButton";
import { btn } from "../ui";

/** Both ways of getting feedback for a pending submission. */
export function GradingPanel({ submissionId, prompt }: { submissionId: string; prompt: string }) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4" data-testid="grading-panel">
      <h2 className="text-lg font-semibold">{t.grading.howTitle}</h2>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold">{t.grading.way1Title}</h3>
        <CommandTip command="/javitas" message={t.grading.way1} testId="javitas-tip">
          <div className="flex flex-wrap items-center gap-3">
            <ImportButton />
            <span className="text-xs text-muted">{t.grading.way1After}</span>
          </div>
        </CommandTip>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold">{t.grading.way2Title}</h3>
        <p className="mt-1 text-sm text-muted">{t.grading.way2}</p>
        <div className="mt-2">
          <CopyButton variant="secondary" label={t.grading.copyPrompt} text={prompt} testId="copy-prompt" />
        </div>
        <label className="mt-3 block text-sm font-medium">
          {t.grading.pasteLabel}
          <textarea
            data-testid="paste-feedback"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t.grading.pastePlaceholder}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs"
          />
        </label>
        <button
          type="button"
          className={`${btn.primary} mt-2`}
          disabled={pending || !text.trim()}
          data-testid="paste-save"
          onClick={() =>
            start(async () => {
              const r = await pasteFeedbackAction(submissionId, text);
              if (r.ok) {
                setErrors([]);
                router.refresh();
              } else setErrors(r.errors);
            })
          }
        >
          {t.grading.pasteSave}
        </button>
        {errors.length > 0 && (
          <div className="mt-2 rounded-md border border-bad/40 bg-bad-soft p-3 text-sm text-bad" data-testid="paste-errors">
            <div className="font-semibold">{t.grading.pasteErrors}</div>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
